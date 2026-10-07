/**
 * Rules of the v1 format that the generated Zod validator cannot check on its own.
 *
 * - S1: JSON Schema cannot compare array lengths, so decision-table cell counts live here.
 * - S2, S3: v1.json expresses these (`anyOf`, `propertyNames`), but json-schema-to-zod drops them.
 * - S4 (frame pair): v1.json states it with `dependentRequired`, which json-schema-to-zod drops.
 * - S5 (group frame keys): `view.groupFrames` keys name groups of the same file, which no JSON
 *   Schema keyword can check.
 * - S6 (style has a colour): v1.json states it with `minProperties: 1`, which json-schema-to-zod
 *   drops.
 * - S7 (edge style has a key): same `minProperties: 1` on `EdgeStyle`.
 * - S8 (tag colour keys): no empty key, and no two keys equal ignoring case and spacing. JSON
 *   Schema cannot compare keys. The key rule (trim, collapse spaces, lower-case) is inlined: the
 *   schema package must not import `@sododeck/model` or `@sododeck/ui`, which carry the same rule.
 * - S9 (anchor needs a side): `route.fromAt` needs `route.fromSide`, `route.toAt` needs
 *   `route.toSide`. A position along a side means nothing without the side. `dependentRequired`
 *   would state it, but json-schema-to-zod drops it.
 * - S10 (offset xor waypoints): a route holds 017's `offset` or free `waypoints`, never both.
 * - S11 (waypoints): the list is not empty, and each waypoint has exactly one of `x` / `dx` and
 *   one of `y` / `dy`. `minItems` makes json-schema-to-typescript emit a tuple type that nothing
 *   can build from a plain array, and `oneOf` per axis is mishandled by the generators (as is
 *   `anyOf`).
 *   S9–S11 hold the same for every connector end, a card or a group (050): sides and bends are
 *   read against the end's card or group frame.
 * - S12 (field definitions, 032): a field id appears once in `fields`; the built-in ids `tech`,
 *   `host` and `owner` keep their kinds (`text`, `text`, `person`); `unit` only on number fields;
 *   `options` only on select and status fields; option ids unique within a field; `icon` only on
 *   status options. JSON Schema cannot tie one key's allowed values to another key's value
 *   without `if` / `then`, which the generators mishandle, nor compare ids across array items.
 * - S13 (values, 032): `node.values` keys are ids (as S3) and never a built-in id: tech, host and
 *   owner keep their own node keys, so one value is never stored twice. `propertyNames` would
 *   state it, but json-schema-to-zod drops it. A value whose field or option is missing, or whose
 *   shape does not fit its field, stays valid: the model keeps and reports it.
 * - S14 (column default, 040): a table column holds at most one of `default` (a value) and
 *   `defaultExpr` (an SQL expression). `not` / `oneOf` would state it, but the generators
 *   mishandle both.
 * - S15 (step touches, 049): no two touches of one step share the same table and column (a table
 *   entry and the entries of its own columns may coexist). `uniqueItems` compares whole objects,
 *   so it would miss two entries that differ only in `access`.
 * - I8, I9 (068): a picture has exactly one of `data` / `path`, and `path` follows `checkPicturePath`.
 * - I1–I6 (images, 055): `images[].asset` has an `assets` entry (I1); an `assets` key is a 64-hex
 *   picture id and `data` decodes to exactly `bytes` bytes (I4: the type allow-list and the 5 MiB
 *   cap are `enum` / `maximum` in v1.json); `images[].group` names a group of the file (I3); an
 *   image id never equals a node, group or sticky id (I5, the one place ids across collections
 *   are compared, because the image takes the fourth place in the connector-end lookup); an image
 *   is at least 32 × 32 (I6, `Size` is shared with cards so the minimum cannot live there). I2
 *   (an `assets` entry no image uses) is allowed. I7 (the key is the SHA-256 of `data`) needs a
 *   hash and runs in `@sododeck/model` when a file is imported.
 *
 * All checks are within one file and one object; unique ids and resolving references are
 * `@sododeck/model`'s job.
 */
import type { SododeckFile } from './generated/types';
import type { FormatRuleCode, IssueCode } from './issue-codes';
import { checkPicturePath, PATH_VIOLATION_TEXT } from './picture-path';
import { toPointer } from './pointer';

/** One reason a file is refused (062, ADR 0039). Public: copied for the user's AI. */
export interface Issue {
  /** Stable code from the catalogue (`@sododeck/model` `problem-codes.ts`). */
  code: IssueCode;
  /** JSON Pointer (RFC 6901) to the offending value, e.g. `/flows/0/steps/2/id`. `""` is the root. */
  path: string;
  message: string;
  /** Id of the object the issue belongs to, when there is one. Never a title. */
  subject?: string;
  /** What was found, at most 200 characters. */
  evidence?: string;
  /** One-sentence fix; when absent the catalogue's default is used. */
  fix?: string;
}

type Path = readonly (string | number)[];

/** Must match `$defs.Id.pattern` in schema/v1.json. */
export const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,64}$/;

function count(n: number, noun: string): string {
  return `${String(n)} ${noun}${n === 1 ? '' : 's'}`;
}

/** Adds one issue: `code`, the pointer of `path`, the message and the owning object's id. */
function report(
  issues: Issue[],
  code: FormatRuleCode,
  path: Path,
  message: string,
  subject?: string,
): void {
  issues.push({
    code,
    path: toPointer(path),
    message,
    ...(subject === undefined ? {} : { subject }),
  });
}

function checkKeys(
  map: Record<string, unknown>,
  path: Path,
  issues: Issue[],
  subject?: string,
): void {
  for (const key of Object.keys(map)) {
    if (!ID_PATTERN.test(key)) {
      report(
        issues,
        'map-key-id',
        [...path, key],
        `Key "${key}" is not a valid id (1–64 letters, digits, "-", "_", "." or ":").`,
        subject,
      );
    }
  }
}

/** Built-in typed fields (032) and their fixed kinds; their values live on their own node keys. */
const BUILT_IN_FIELD_KINDS: Readonly<Record<string, string>> = {
  tech: 'text',
  host: 'text',
  owner: 'person',
};

/** Must match `$defs.AssetId.pattern` in schema/v1.json. */
export const ASSET_ID_PATTERN = /^[0-9a-f]{64}$/;

/** Smallest image side in canvas pixels (rule I6). The model and the app use the same number. */
export const IMAGE_MIN_SIDE = 32;

/** Decoded length of base64 data, or `undefined` when its length is not a multiple of 4. */
function base64Length(data: string): number | undefined {
  if (data.length % 4 !== 0) return undefined;
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return (data.length / 4) * 3 - padding;
}

/** Returns every S1–S15 and I1–I6 violation in a structurally valid file (empty when there are none). */
export function checkSemanticRules(file: SododeckFile): Issue[] {
  const issues: Issue[] = [];

  checkKeys(file.rules, ['rules'], issues);
  for (const [ruleId, rule] of Object.entries(file.rules)) {
    rule.rows.forEach((row, index) => {
      const path = ['rules', ruleId, 'rows', index];
      if (row.when.length !== rule.inputs.length) {
        report(
          issues,
          'rule-row-cells',
          [...path, 'when'],
          `Rule "${ruleId}" row "${row.id}" has ${count(row.when.length, '"when" cell')} but ${count(rule.inputs.length, 'input column')}.`,
          ruleId,
        );
      }
      if (row.then.length !== rule.outputs.length) {
        report(
          issues,
          'rule-row-cells',
          [...path, 'then'],
          `Rule "${ruleId}" row "${row.id}" has ${count(row.then.length, '"then" cell')} but ${count(rule.outputs.length, 'output column')}.`,
          ruleId,
        );
      }
    });
  }

  file.groups.forEach((group, index) => {
    if ((group.position === undefined) !== (group.size === undefined)) {
      report(
        issues,
        'group-frame-pair',
        ['groups', index],
        `Group "${group.id}" needs both a position and a size, or neither.`,
        group.id,
      );
    }
  });

  function checkStyle(
    id: string,
    style: { fill?: unknown; stroke?: unknown } | undefined,
    path: Path,
  ): void {
    if (style !== undefined && style.fill === undefined && style.stroke === undefined) {
      report(issues, 'style-empty', path, `Style of "${id}" needs a fill, a stroke, or both.`, id);
    }
  }
  file.nodes.forEach((node, index) => {
    checkStyle(node.id, node.style, ['nodes', index, 'style']);
  });
  file.groups.forEach((group, index) => {
    checkStyle(group.id, group.style, ['groups', index, 'style']);
  });

  file.edges.forEach((edge, index) => {
    if (edge.style !== undefined && Object.keys(edge.style).length === 0) {
      report(
        issues,
        'edge-style-empty',
        ['edges', index, 'style'],
        `Style of connector "${edge.id}" needs at least one key.`,
        edge.id,
      );
    }
  });

  file.edges.forEach((edge, index) => {
    const route = edge.route;
    if (route === undefined) return;
    const path = ['edges', index, 'route'];
    if (route.fromAt !== undefined && route.fromSide === undefined) {
      report(
        issues,
        'route-anchor-side',
        [...path, 'fromAt'],
        `Connector "${edge.id}" has a "fromAt" position but no "fromSide".`,
        edge.id,
      );
    }
    if (route.toAt !== undefined && route.toSide === undefined) {
      report(
        issues,
        'route-anchor-side',
        [...path, 'toAt'],
        `Connector "${edge.id}" has a "toAt" position but no "toSide".`,
        edge.id,
      );
    }
    if (route.offset !== undefined && route.waypoints !== undefined) {
      report(
        issues,
        'route-offset-and-waypoints',
        path,
        `Connector "${edge.id}" route has both "offset" and "waypoints"; use one.`,
        edge.id,
      );
    }
    if (route.waypoints?.length === 0) {
      report(
        issues,
        'route-waypoint',
        [...path, 'waypoints'],
        `Connector "${edge.id}" has an empty "waypoints" list; remove it instead.`,
        edge.id,
      );
    }
    route.waypoints?.forEach((point, pointIndex) => {
      const pointPath = [...path, 'waypoints', pointIndex];
      if ((point.x === undefined) === (point.dx === undefined)) {
        report(
          issues,
          'route-waypoint',
          pointPath,
          `Bend ${String(pointIndex + 1)} of "${edge.id}" needs exactly one of "x" and "dx".`,
          edge.id,
        );
      }
      if ((point.y === undefined) === (point.dy === undefined)) {
        report(
          issues,
          'route-waypoint',
          pointPath,
          `Bend ${String(pointIndex + 1)} of "${edge.id}" needs exactly one of "y" and "dy".`,
          edge.id,
        );
      }
    });
  });

  const groupIds = new Set(file.groups.map((group) => group.id));
  file.views.forEach((view, index) => {
    if (view.positions !== undefined) {
      checkKeys(view.positions, ['views', index, 'positions'], issues, view.id);
    }
    if (view.groupFrames !== undefined) {
      const path = ['views', index, 'groupFrames'];
      checkKeys(view.groupFrames, path, issues, view.id);
      for (const key of Object.keys(view.groupFrames)) {
        if (ID_PATTERN.test(key) && !groupIds.has(key)) {
          report(
            issues,
            'view-frame-group',
            [...path, key],
            `Key "${key}" is not the id of a group in this file.`,
            view.id,
          );
        }
      }
    }
  });

  file.flows.forEach((flow, flowIndex) => {
    flow.steps.forEach((step, stepIndex) => {
      if (step.ruleInputs === undefined) return;
      const path = ['flows', flowIndex, 'steps', stepIndex, 'ruleInputs'];
      checkKeys(step.ruleInputs, path, issues, step.id);
      for (const [ruleId, inputs] of Object.entries(step.ruleInputs)) {
        checkKeys(inputs, [...path, ruleId], issues, step.id);
      }
    });
  });

  if (file.tagColors !== undefined) {
    const seen = new Map<string, string>();
    for (const key of Object.keys(file.tagColors)) {
      const identity = key.trim().replace(/\s+/g, ' ').toLowerCase();
      const path = ['tagColors', key];
      if (identity === '') {
        report(issues, 'tag-color-key', path, `Tag colour key "${key}" is empty.`);
        continue;
      }
      const first = seen.get(identity);
      if (first === undefined) {
        seen.set(identity, key);
      } else {
        report(
          issues,
          'tag-color-key',
          path,
          `Tag colour key "${key}" is the same tag as "${first}" (case and spacing are ignored).`,
        );
      }
    }
  }

  const fieldIds = new Set<string>();
  file.fields?.forEach((field, index) => {
    const path = ['fields', index];
    if (fieldIds.has(field.id)) {
      report(
        issues,
        'field-definition',
        [...path, 'id'],
        `Field id "${field.id}" is used by more than one field.`,
        field.id,
      );
    }
    fieldIds.add(field.id);
    const builtIn = BUILT_IN_FIELD_KINDS[field.id];
    if (builtIn !== undefined && field.kind !== builtIn) {
      report(
        issues,
        'field-definition',
        [...path, 'kind'],
        `Built-in field "${field.id}" must have kind "${builtIn}".`,
        field.id,
      );
    }
    if (field.unit !== undefined && field.kind !== 'number') {
      report(
        issues,
        'field-definition',
        [...path, 'unit'],
        `Field "${field.id}" has a unit, but only number fields have one.`,
        field.id,
      );
    }
    const choice = field.kind === 'select' || field.kind === 'status';
    if (field.options !== undefined && !choice) {
      report(
        issues,
        'field-definition',
        [...path, 'options'],
        `Field "${field.id}" has options, but only select and status fields have them.`,
        field.id,
      );
    }
    const optionIds = new Set<string>();
    field.options?.forEach((option, optionIndex) => {
      const optionPath = [...path, 'options', optionIndex];
      if (option.icon !== undefined && field.kind !== 'status') {
        report(
          issues,
          'field-definition',
          [...optionPath, 'icon'],
          `Option "${option.id}" of field "${field.id}" has an icon, but only status options have one.`,
          option.id,
        );
      }
      if (optionIds.has(option.id)) {
        report(
          issues,
          'field-definition',
          [...optionPath, 'id'],
          `Option id "${option.id}" is used twice in field "${field.id}".`,
          option.id,
        );
      }
      optionIds.add(option.id);
    });
  });

  file.nodes.forEach((node, index) => {
    if (node.values === undefined) return;
    const path = ['nodes', index, 'values'];
    checkKeys(node.values, path, issues, node.id);
    for (const key of Object.keys(node.values)) {
      if (Object.hasOwn(BUILT_IN_FIELD_KINDS, key)) {
        report(
          issues,
          'card-value-key',
          [...path, key],
          `Card "${node.id}" stores built-in field "${key}" in values; use its own key.`,
          node.id,
        );
      }
    }
  });

  file.nodes.forEach((node, index) => {
    node.columns?.forEach((column, columnIndex) => {
      if (column.default !== undefined && column.defaultExpr !== undefined) {
        report(
          issues,
          'column-default',
          ['nodes', index, 'columns', columnIndex, 'defaultExpr'],
          `Column "${column.id}" has both a default value and a default expression; keep one.`,
          column.id,
        );
      }
    });
  });

  file.flows.forEach((flow, flowIndex) => {
    flow.steps.forEach((step, stepIndex) => {
      const seen = new Set<string>();
      step.touches?.forEach((touch, touchIndex) => {
        const key = `${touch.table}\u0000${touch.column ?? ''}`;
        if (seen.has(key)) {
          const what =
            touch.column === undefined
              ? `table "${touch.table}"`
              : `column "${touch.column}" of table "${touch.table}"`;
          report(
            issues,
            'step-touch-repeat',
            ['flows', flowIndex, 'steps', stepIndex, 'touches', touchIndex],
            `Step "${step.id}" touches ${what} twice; keep one entry.`,
            step.id,
          );
        }
        seen.add(key);
      });
    });
  });

  // A legacy `anchor` still places a note (ADR 0041: the model turns it into a position on load).
  file.stickies.forEach((sticky, index) => {
    if (sticky.anchor === undefined && sticky.position === undefined) {
      report(
        issues,
        'sticky-placement',
        ['stickies', index],
        `Sticky "${sticky.id}" needs a position.`,
        sticky.id,
      );
    }
  });

  const assets = file.assets ?? {};
  for (const [key, asset] of Object.entries(assets)) {
    const path = ['assets', key];
    if (!ASSET_ID_PATTERN.test(key)) {
      report(
        issues,
        'asset-id',
        path,
        `Key "${key}" is not a picture id (64 lowercase hex characters).`,
        key,
      );
    }
    if (asset.data !== undefined && asset.path !== undefined) {
      report(
        issues,
        'image-asset-source',
        path,
        `Picture "${key}" needs exactly one of "data" or "path"; this one has both.`,
        key,
      );
    } else if (asset.data === undefined && asset.path === undefined) {
      report(
        issues,
        'image-asset-source',
        path,
        `Picture "${key}" needs exactly one of "data" or "path"; this one has neither.`,
        key,
      );
    }
    if (asset.path !== undefined) {
      const violation = checkPicturePath(asset.path);
      if (violation !== null) {
        report(
          issues,
          'image-asset-path',
          [...path, 'path'],
          `The picture path "${asset.path}" ${PATH_VIOLATION_TEXT[violation]}`,
          key,
        );
      }
    }
    const decoded = asset.data === undefined ? undefined : base64Length(asset.data);
    if (asset.data === undefined) {
      // A pointed-at picture: its bytes are in the file, not here.
    } else if (decoded === undefined) {
      report(
        issues,
        'asset-data',
        [...path, 'data'],
        `Picture "${key}" has base64 data whose length is not a multiple of 4.`,
        key,
      );
    } else if (decoded !== asset.bytes) {
      report(
        issues,
        'asset-data',
        [...path, 'data'],
        `Picture "${key}" says ${count(asset.bytes, 'byte')} but its data holds ${count(decoded, 'byte')}.`,
        key,
      );
    }
  }

  const takenIds = new Set<string>([
    ...file.nodes.map((node) => node.id),
    ...file.groups.map((group) => group.id),
    ...file.stickies.map((sticky) => sticky.id),
  ]);
  file.images?.forEach((image, index) => {
    const path = ['images', index];
    if (!Object.hasOwn(assets, image.asset)) {
      report(
        issues,
        'image-asset-missing',
        [...path, 'asset'],
        `Image "${image.id}" uses picture "${image.asset}", which is not in "assets".`,
        image.id,
      );
    }
    if (image.group !== undefined && !groupIds.has(image.group)) {
      report(
        issues,
        'image-group-missing',
        [...path, 'group'],
        `Image "${image.id}" belongs to group "${image.group}", which is not in this file.`,
        image.id,
      );
    }
    if (takenIds.has(image.id)) {
      report(
        issues,
        'image-id-clash',
        [...path, 'id'],
        `Image id "${image.id}" is already the id of a card, group or sticky.`,
        image.id,
      );
    }
    takenIds.add(image.id);
    for (const side of ['width', 'height'] as const) {
      if (image.size[side] < IMAGE_MIN_SIDE) {
        report(
          issues,
          'image-too-small',
          [...path, 'size', side],
          `Image "${image.id}" is ${String(image.size[side])} px ${side === 'width' ? 'wide' : 'tall'}; the minimum is ${String(IMAGE_MIN_SIDE)}.`,
          image.id,
        );
      }
    }
  });

  return issues;
}

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
 *
 * All checks are within one file and one object; unique ids and resolving references are
 * `@sododeck/model`'s job.
 */
import type { SododeckFile } from './generated/types';

export interface Issue {
  /** Dotted path to the offending value, e.g. `flows.0.steps.2.id`. Empty for the file root. */
  path: string;
  message: string;
}

/** Must match `$defs.Id.pattern` in schema/v1.json. */
export const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,64}$/;

function count(n: number, noun: string): string {
  return `${String(n)} ${noun}${n === 1 ? '' : 's'}`;
}

function checkKeys(map: Record<string, unknown>, path: string, issues: Issue[]): void {
  for (const key of Object.keys(map)) {
    if (!ID_PATTERN.test(key)) {
      issues.push({
        path: `${path}.${key}`,
        message: `Key "${key}" is not a valid id (1–64 letters, digits, "-", "_", "." or ":").`,
      });
    }
  }
}

/** Built-in typed fields (032) and their fixed kinds; their values live on their own node keys. */
const BUILT_IN_FIELD_KINDS: Readonly<Record<string, string>> = {
  tech: 'text',
  host: 'text',
  owner: 'person',
};

/** Returns every S1–S15 violation in a structurally valid file (empty when there are none). */
export function checkSemanticRules(file: SododeckFile): Issue[] {
  const issues: Issue[] = [];

  checkKeys(file.rules, 'rules', issues);
  for (const [ruleId, rule] of Object.entries(file.rules)) {
    rule.rows.forEach((row, index) => {
      const path = `rules.${ruleId}.rows.${String(index)}`;
      if (row.when.length !== rule.inputs.length) {
        issues.push({
          path: `${path}.when`,
          message: `Rule "${ruleId}" row "${row.id}" has ${count(row.when.length, '"when" cell')} but ${count(rule.inputs.length, 'input column')}.`,
        });
      }
      if (row.then.length !== rule.outputs.length) {
        issues.push({
          path: `${path}.then`,
          message: `Rule "${ruleId}" row "${row.id}" has ${count(row.then.length, '"then" cell')} but ${count(rule.outputs.length, 'output column')}.`,
        });
      }
    });
  }

  file.groups.forEach((group, index) => {
    if ((group.position === undefined) !== (group.size === undefined)) {
      issues.push({
        path: `groups.${String(index)}`,
        message: `Group "${group.id}" needs both a position and a size, or neither.`,
      });
    }
  });

  function checkStyle(
    id: string,
    style: { fill?: unknown; stroke?: unknown } | undefined,
    path: string,
  ): void {
    if (style !== undefined && style.fill === undefined && style.stroke === undefined) {
      issues.push({ path, message: `Style of "${id}" needs a fill, a stroke, or both.` });
    }
  }
  file.nodes.forEach((node, index) => {
    checkStyle(node.id, node.style, `nodes.${String(index)}.style`);
  });
  file.groups.forEach((group, index) => {
    checkStyle(group.id, group.style, `groups.${String(index)}.style`);
  });

  file.edges.forEach((edge, index) => {
    if (edge.style !== undefined && Object.keys(edge.style).length === 0) {
      issues.push({
        path: `edges.${String(index)}.style`,
        message: `Style of connector "${edge.id}" needs at least one key.`,
      });
    }
  });

  file.edges.forEach((edge, index) => {
    const route = edge.route;
    if (route === undefined) return;
    const path = `edges.${String(index)}.route`;
    if (route.fromAt !== undefined && route.fromSide === undefined) {
      issues.push({
        path: `${path}.fromAt`,
        message: `Connector "${edge.id}" has a "fromAt" position but no "fromSide".`,
      });
    }
    if (route.toAt !== undefined && route.toSide === undefined) {
      issues.push({
        path: `${path}.toAt`,
        message: `Connector "${edge.id}" has a "toAt" position but no "toSide".`,
      });
    }
    if (route.offset !== undefined && route.waypoints !== undefined) {
      issues.push({
        path,
        message: `Connector "${edge.id}" route has both "offset" and "waypoints"; use one.`,
      });
    }
    if (route.waypoints?.length === 0) {
      issues.push({
        path: `${path}.waypoints`,
        message: `Connector "${edge.id}" has an empty "waypoints" list; remove it instead.`,
      });
    }
    route.waypoints?.forEach((point, pointIndex) => {
      const pointPath = `${path}.waypoints.${String(pointIndex)}`;
      if ((point.x === undefined) === (point.dx === undefined)) {
        issues.push({
          path: pointPath,
          message: `Bend ${String(pointIndex + 1)} of "${edge.id}" needs exactly one of "x" and "dx".`,
        });
      }
      if ((point.y === undefined) === (point.dy === undefined)) {
        issues.push({
          path: pointPath,
          message: `Bend ${String(pointIndex + 1)} of "${edge.id}" needs exactly one of "y" and "dy".`,
        });
      }
    });
  });

  const groupIds = new Set(file.groups.map((group) => group.id));
  file.views.forEach((view, index) => {
    if (view.positions !== undefined) {
      checkKeys(view.positions, `views.${String(index)}.positions`, issues);
    }
    if (view.groupFrames !== undefined) {
      const path = `views.${String(index)}.groupFrames`;
      checkKeys(view.groupFrames, path, issues);
      for (const key of Object.keys(view.groupFrames)) {
        if (ID_PATTERN.test(key) && !groupIds.has(key)) {
          issues.push({
            path: `${path}.${key}`,
            message: `Key "${key}" is not the id of a group in this file.`,
          });
        }
      }
    }
  });

  file.flows.forEach((flow, flowIndex) => {
    flow.steps.forEach((step, stepIndex) => {
      if (step.ruleInputs === undefined) return;
      const path = `flows.${String(flowIndex)}.steps.${String(stepIndex)}.ruleInputs`;
      checkKeys(step.ruleInputs, path, issues);
      for (const [ruleId, inputs] of Object.entries(step.ruleInputs)) {
        checkKeys(inputs, `${path}.${ruleId}`, issues);
      }
    });
  });

  if (file.tagColors !== undefined) {
    const seen = new Map<string, string>();
    for (const key of Object.keys(file.tagColors)) {
      const identity = key.trim().replace(/\s+/g, ' ').toLowerCase();
      const path = `tagColors.${key}`;
      if (identity === '') {
        issues.push({ path, message: `Tag colour key "${key}" is empty.` });
        continue;
      }
      const first = seen.get(identity);
      if (first === undefined) {
        seen.set(identity, key);
      } else {
        issues.push({
          path,
          message: `Tag colour key "${key}" is the same tag as "${first}" (case and spacing are ignored).`,
        });
      }
    }
  }

  const fieldIds = new Set<string>();
  file.fields?.forEach((field, index) => {
    const path = `fields.${String(index)}`;
    if (fieldIds.has(field.id)) {
      issues.push({
        path: `${path}.id`,
        message: `Field id "${field.id}" is used by more than one field.`,
      });
    }
    fieldIds.add(field.id);
    const builtIn = BUILT_IN_FIELD_KINDS[field.id];
    if (builtIn !== undefined && field.kind !== builtIn) {
      issues.push({
        path: `${path}.kind`,
        message: `Built-in field "${field.id}" must have kind "${builtIn}".`,
      });
    }
    if (field.unit !== undefined && field.kind !== 'number') {
      issues.push({
        path: `${path}.unit`,
        message: `Field "${field.id}" has a unit, but only number fields have one.`,
      });
    }
    const choice = field.kind === 'select' || field.kind === 'status';
    if (field.options !== undefined && !choice) {
      issues.push({
        path: `${path}.options`,
        message: `Field "${field.id}" has options, but only select and status fields have them.`,
      });
    }
    const optionIds = new Set<string>();
    field.options?.forEach((option, optionIndex) => {
      const optionPath = `${path}.options.${String(optionIndex)}`;
      if (option.icon !== undefined && field.kind !== 'status') {
        issues.push({
          path: `${optionPath}.icon`,
          message: `Option "${option.id}" of field "${field.id}" has an icon, but only status options have one.`,
        });
      }
      if (optionIds.has(option.id)) {
        issues.push({
          path: `${optionPath}.id`,
          message: `Option id "${option.id}" is used twice in field "${field.id}".`,
        });
      }
      optionIds.add(option.id);
    });
  });

  file.nodes.forEach((node, index) => {
    if (node.values === undefined) return;
    const path = `nodes.${String(index)}.values`;
    checkKeys(node.values, path, issues);
    for (const key of Object.keys(node.values)) {
      if (Object.hasOwn(BUILT_IN_FIELD_KINDS, key)) {
        issues.push({
          path: `${path}.${key}`,
          message: `Card "${node.id}" stores built-in field "${key}" in values; use its own key.`,
        });
      }
    }
  });

  file.nodes.forEach((node, index) => {
    node.columns?.forEach((column, columnIndex) => {
      if (column.default !== undefined && column.defaultExpr !== undefined) {
        issues.push({
          path: `nodes.${String(index)}.columns.${String(columnIndex)}.defaultExpr`,
          message: `Column "${column.id}" has both a default value and a default expression; keep one.`,
        });
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
          issues.push({
            path: `flows.${String(flowIndex)}.steps.${String(stepIndex)}.touches.${String(touchIndex)}`,
            message: `Step "${step.id}" touches ${what} twice; keep one entry.`,
          });
        }
        seen.add(key);
      });
    });
  });

  file.stickies.forEach((sticky, index) => {
    if (sticky.anchor === undefined && sticky.position === undefined) {
      issues.push({
        path: `stickies.${String(index)}`,
        message: `Sticky "${sticky.id}" needs an anchor, a position, or both.`,
      });
    }
  });

  return issues;
}

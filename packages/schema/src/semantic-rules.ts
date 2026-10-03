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
 * - S11 (one key per axis): each waypoint has exactly one of `x` / `dx` and one of `y` / `dy`.
 *   `oneOf` per axis would state it, but the generators mishandle it (as with `anyOf`).
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

/** Returns every S1–S11 violation in a structurally valid file (empty when there are none). */
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

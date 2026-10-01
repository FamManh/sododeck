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

/** Returns every S1–S5 violation in a structurally valid file (empty when there are none). */
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

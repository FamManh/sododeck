/**
 * Rules of the v1 format that the generated Zod validator cannot check on its own.
 *
 * - S1: JSON Schema cannot compare array lengths, so decision-table cell counts live here.
 * - S2, S3: v1.json expresses these (`anyOf`, `propertyNames`), but json-schema-to-zod drops them.
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

/** Returns every S1–S3 violation in a structurally valid file (empty when there are none). */
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

  file.views.forEach((view, index) => {
    if (view.positions !== undefined) {
      checkKeys(view.positions, `views.${String(index)}.positions`, issues);
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

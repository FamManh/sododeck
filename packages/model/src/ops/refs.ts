/** Which fields of each object hold references, for checks on add and update (data-model.md). */
import type { Id } from '@sododeck/schema';

import { isRecord } from '../convert';
import type { Collection } from '../layout';
import type { Ref } from '../validate';

function idList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** References held by `field` of an object of collection `c`, with value `value`. */
export function refsOf(c: Collection, field: string, value: unknown): Ref[] {
  const one = (target: Ref['target']): Ref[] =>
    typeof value === 'string' ? [{ path: field, id: value, target }] : [];
  const many = (target: Ref['target']): Ref[] =>
    idList(value).map((id, i) => ({ path: `${field}.${String(i)}`, id, target }));

  switch (`${c}.${field}`) {
    case 'edges.from':
    case 'edges.to':
      // A connector end is a node, a group (050) or a sticky (053).
      return one('nodes|groups|stickies');
    case 'nodes.parent':
      return one('nodes');
    case 'nodes.group':
    case 'groups.parent':
      return one('groups');
    case 'nodes.rules':
      return many('rule');
    case 'views.feature':
    case 'flows.feature':
      return one('features');
    case 'views.includes':
    case 'views.pinned':
      return many('nodes');
    case 'views.excludeGroups':
    case 'views.collapsed':
      return many('groups');
    case 'views.positions':
      return isRecord(value)
        ? Object.keys(value).map((id) => ({ path: `${field}.${id}`, id, target: 'nodes' as const }))
        : [];
    case 'stickies.anchor':
      return one('any');
    default:
      return [];
  }
}

/** Every reference a whole object holds. */
export function allRefsOf(c: Collection, object: Record<string, unknown>): Ref[] {
  return Object.entries(object).flatMap(([field, value]) => refsOf(c, field, value));
}

/**
 * `step.branch` must name a branch of the step's own flow (ADR 0008). `branchIds` are the ids of
 * that flow's branches.
 */
export function stepBranchIssues(
  step: Record<string, unknown>,
  prefix: string,
  branchIds: ReadonlySet<Id>,
): { path: string; message: string }[] {
  return typeof step.branch === 'string' && !branchIds.has(step.branch)
    ? [{ path: `${prefix}branch`, message: `"${step.branch}" is not a branch of this flow.` }]
    : [];
}

/**
 * References of a step: its edge, its rules, and its sample inputs, which must belong to one of
 * the step's rules and name an input column of that rule.
 */
export function stepRefs(
  step: Record<string, unknown>,
  prefix: string,
  inputColumns: (ruleId: Id) => ReadonlySet<Id> | undefined,
): { refs: Ref[]; issues: { path: string; message: string }[] } {
  const refs: Ref[] = [];
  const issues: { path: string; message: string }[] = [];
  if (typeof step.edge === 'string')
    refs.push({ path: `${prefix}edge`, id: step.edge, target: 'edges' });
  const rules = idList(step.rules);
  rules.forEach((id, i) => refs.push({ path: `${prefix}rules.${String(i)}`, id, target: 'rule' }));
  if (isRecord(step.ruleInputs)) {
    for (const [ruleId, inputs] of Object.entries(step.ruleInputs)) {
      const path = `${prefix}ruleInputs.${ruleId}`;
      if (!rules.includes(ruleId)) {
        issues.push({ path, message: `Rule "${ruleId}" is not attached to this step.` });
        continue;
      }
      const columns = inputColumns(ruleId);
      if (columns === undefined || !isRecord(inputs)) continue;
      for (const columnId of Object.keys(inputs)) {
        if (!columns.has(columnId)) {
          issues.push({
            path: `${path}.${columnId}`,
            message: `"${columnId}" is not an input column of rule "${ruleId}".`,
          });
        }
      }
    }
  }
  return { refs, issues };
}

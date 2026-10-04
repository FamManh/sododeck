/**
 * Referential integrity report (research R8, spec FR-030/031). Pure and JSON-based, so it runs on
 * `toJSON(doc)` output, in a worker, or on a file that was never loaded. Feature 015 shows these
 * problems to users; 002 only produces them.
 */
import type { Id, SododeckFile } from '@sododeck/schema';

import type { ObjectRef } from './layout';

export interface IntegrityProblem {
  /**
   * `duplicate-id` (050): a group whose id is also a node's, so a connector end naming it is
   * ambiguous. Reported on the group, `field: 'id'`, `targetType: 'node'`.
   */
  kind: 'missing-reference' | 'ambiguous-anchor' | 'cycle' | 'detached-rule-input' | 'duplicate-id';
  /** The object holding the reference. */
  object: ObjectRef;
  /** The field, e.g. `from`, `edge`, `rules`, `ruleInputs.R-1.in2`, `anchor`, `parent`. */
  field: string;
  /** The missing, ambiguous or cyclic id. */
  target: Id;
  targetType: 'node' | 'group' | 'edge' | 'feature' | 'branch' | 'rule' | 'rule-column' | 'object';
}

type TargetType = IntegrityProblem['targetType'];

/** Parent chains that loop, each once, as lists of ids. */
function findCycles(entries: readonly { id: Id; parent?: Id }[]): Id[][] {
  const parentOf = new Map<Id, Id | undefined>();
  for (const { id, parent } of entries) if (!parentOf.has(id)) parentOf.set(id, parent);
  const state = new Map<Id, 'visiting' | 'done'>();
  const cycles: Id[][] = [];
  for (const start of parentOf.keys()) {
    const path: Id[] = [];
    let current: Id | undefined = start;
    while (current !== undefined && parentOf.has(current) && !state.has(current)) {
      state.set(current, 'visiting');
      path.push(current);
      current = parentOf.get(current);
    }
    if (current !== undefined && state.get(current) === 'visiting') {
      cycles.push(path.slice(path.indexOf(current)));
    }
    for (const id of path) state.set(id, 'done');
  }
  return cycles;
}

/**
 * Every broken reference, parent cycle and node / group id collision (050) in `file`. Empty for a
 * consistent deck.
 */
export function checkIntegrity(file: SododeckFile): IntegrityProblem[] {
  const problems: IntegrityProblem[] = [];
  const ids = (items: readonly { id: Id }[]) => new Set(items.map((item) => item.id));
  const nodes = ids(file.nodes);
  const groups = ids(file.groups);
  const edges = ids(file.edges);
  const features = ids(file.features);
  const hasRule = (id: Id) => Object.hasOwn(file.rules, id);

  // How many objects each id names, for sticky anchors (which may point at any object).
  const anchors = new Map<Id, number>();
  const count = (id: Id) => anchors.set(id, (anchors.get(id) ?? 0) + 1);
  for (const c of ['nodes', 'groups', 'edges', 'views', 'features', 'flows', 'stickies'] as const) {
    for (const item of file[c]) count(item.id);
  }
  for (const flow of file.flows) for (const step of flow.steps) count(step.id);
  for (const id of Object.keys(file.rules)) count(id);

  const report = (
    object: ObjectRef,
    field: string,
    target: Id,
    targetType: TargetType,
    kind: IntegrityProblem['kind'] = 'missing-reference',
  ) => problems.push({ kind, object, field, target, targetType });
  const check = (
    object: ObjectRef,
    field: string,
    target: Id | undefined,
    set: ReadonlySet<Id>,
    type: TargetType,
  ) => {
    if (target !== undefined && !set.has(target)) report(object, field, target, type);
  };
  const checkRules = (object: ObjectRef, rules: readonly Id[] | undefined) => {
    for (const id of rules ?? []) if (!hasRule(id)) report(object, 'rules', id, 'rule');
  };

  for (const node of file.nodes) {
    const object: ObjectRef = { scope: 'nodes', id: node.id };
    check(object, 'group', node.group, groups, 'group');
    check(object, 'parent', node.parent, nodes, 'node');
    checkRules(object, node.rules);
  }
  const reportedIds = new Set<Id>();
  for (const group of file.groups) {
    const object: ObjectRef = { scope: 'groups', id: group.id };
    check(object, 'parent', group.parent, groups, 'group');
    if (nodes.has(group.id) && !reportedIds.has(group.id)) {
      reportedIds.add(group.id);
      report(object, 'id', group.id, 'node', 'duplicate-id');
    }
  }
  // A connector end names a node or a group (050). `targetType` stays `node` for a broken end.
  const ends: ReadonlySet<Id> = new Set([...nodes, ...groups]);
  for (const edge of file.edges) {
    const object: ObjectRef = { scope: 'edges', id: edge.id };
    check(object, 'from', edge.from, ends, 'node');
    check(object, 'to', edge.to, ends, 'node');
  }
  for (const view of file.views) {
    const object: ObjectRef = { scope: 'views', id: view.id };
    check(object, 'feature', view.feature, features, 'feature');
    for (const id of view.includes ?? []) check(object, 'includes', id, nodes, 'node');
    for (const id of view.excludeGroups ?? []) check(object, 'excludeGroups', id, groups, 'group');
    for (const id of Object.keys(view.positions ?? {}))
      check(object, 'positions', id, nodes, 'node');
    for (const id of view.pinned ?? []) check(object, 'pinned', id, nodes, 'node');
    for (const id of view.collapsed ?? []) check(object, 'collapsed', id, groups, 'group');
  }
  for (const flow of file.flows) {
    check({ scope: 'flows', id: flow.id }, 'feature', flow.feature, features, 'feature');
    const branches = ids(flow.branches ?? []);
    for (const step of flow.steps) {
      const object: ObjectRef = {
        scope: 'flows',
        id: flow.id,
        child: { kind: 'step', id: step.id },
      };
      check(object, 'edge', step.edge, edges, 'edge');
      // Only hand-edited files can hold this: the editor refuses it (006, ADR 0008).
      check(object, 'branch', step.branch, branches, 'branch');
      checkRules(object, step.rules);
      for (const [ruleId, inputs] of Object.entries(step.ruleInputs ?? {})) {
        if (!(step.rules ?? []).includes(ruleId)) {
          report(object, `ruleInputs.${ruleId}`, ruleId, 'rule', 'detached-rule-input');
          continue;
        }
        const rule = file.rules[ruleId];
        if (rule === undefined) continue; // Already reported on `rules`.
        const columns = ids(rule.inputs);
        for (const columnId of Object.keys(inputs)) {
          check(object, `ruleInputs.${ruleId}.${columnId}`, columnId, columns, 'rule-column');
        }
      }
    }
  }
  for (const sticky of file.stickies) {
    if (sticky.anchor === undefined) continue;
    const matches = anchors.get(sticky.anchor) ?? 0;
    if (matches !== 1) {
      report(
        { scope: 'stickies', id: sticky.id },
        'anchor',
        sticky.anchor,
        'object',
        matches === 0 ? 'missing-reference' : 'ambiguous-anchor',
      );
    }
  }

  const reportCycles = (
    scope: 'groups' | 'nodes',
    entries: readonly { id: Id; parent?: Id }[],
    type: TargetType,
  ) => {
    for (const cycle of findCycles(entries)) {
      const smallest = [...cycle].sort()[0];
      const parent = entries.find((e) => e.id === smallest)?.parent;
      if (smallest !== undefined && parent !== undefined) {
        report({ scope, id: smallest }, 'parent', parent, type, 'cycle');
      }
    }
  };
  reportCycles('groups', file.groups, 'group');
  reportCycles('nodes', file.nodes, 'node');
  return problems;
}

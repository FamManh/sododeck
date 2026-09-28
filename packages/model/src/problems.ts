/**
 * Deck-wide problems (feature 015, ADR 0013): orphan components, duplicate connections, flow and
 * rule problems and broken references, gathered from the existing checks (`analyzeFlow`,
 * `ruleChecks`, `checkIntegrity`) plus three new ones. Pure and JSON-based so it runs in a worker.
 * Problems are derived for display and never stored in the deck (§g-23).
 */
import type { Edge, Flow, Id, Node, SododeckFile } from '@sododeck/schema';

import { analyzeFlow, type FlowAnalysis, type PathStep } from './flow-paths';
import { stickyLabel } from './geometry';
import { checkIntegrity, type IntegrityProblem } from './integrity';
import type { ObjectRef } from './layout';
import { ruleChecks } from './rules/evaluate';

export type ProblemKind =
  | 'orphan'
  | 'duplicate-connection'
  | 'step-without-connection'
  | 'broken-chain'
  | 'incomplete-flow'
  | 'overlapping-conditions'
  | 'missing-rule'
  | 'rule-without-catch-all'
  | 'invalid-rule-cells'
  | 'broken-reference';

/** List order of the kinds (research R3). */
export const PROBLEM_KINDS: readonly ProblemKind[] = [
  'orphan',
  'duplicate-connection',
  'step-without-connection',
  'broken-chain',
  'incomplete-flow',
  'overlapping-conditions',
  'missing-rule',
  'rule-without-catch-all',
  'invalid-rule-cells',
  'broken-reference',
];

/** Where a problem is fixed. */
export type ProblemTarget =
  | { type: 'node'; id: Id }
  | { type: 'edges'; ids: readonly Id[] }
  | { type: 'flow'; flowId: Id; stepId?: Id; branchIds?: readonly Id[] }
  | { type: 'rule'; ruleId: Id }
  /** The object holding a broken reference (group, view, sticky…). */
  | { type: 'object'; ref: ObjectRef };

export interface Problem {
  /** Stable across re-computation: kind plus the ids involved. */
  key: string;
  kind: ProblemKind;
  target: ProblemTarget;
  /** "Orphan component" */
  title: string;
  /** "Legacy Invoicer has no connections" */
  detail: string;
  /** Sort key: the title of the main object. */
  objectTitle: string;
  /** Step position within a flow, else 0. */
  order: number;
}

export interface DeckProblems {
  /** Sorted by kind, object title, step order, then key. */
  list: readonly Problem[];
  total: number;
  /** Node, edge, flow and rule ids (and other holders) → their problems, for glyphs. */
  byObject: ReadonlyMap<Id, readonly Problem[]>;
}

/** Trimmed, lower-case, runs of whitespace collapsed: how labels and conditions are compared. */
function norm(text: string | undefined): string {
  return (text ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

const times = (n: number) => (n === 2 ? 'twice' : `${String(n)} times`);

interface Draft {
  kind: ProblemKind;
  ids: readonly Id[];
  target: ProblemTarget;
  title: string;
  detail: string;
  objectTitle: string;
  order?: number;
  /** Object ids to show the problem on (defaults to the target's ids). */
  on: readonly Id[];
}

const TITLES: Record<ProblemKind, string> = {
  orphan: 'Orphan component',
  'duplicate-connection': 'Duplicate connection',
  'step-without-connection': 'Step without connection',
  'broken-chain': 'Broken flow',
  'incomplete-flow': 'Incomplete flow',
  'overlapping-conditions': 'Overlapping conditions',
  'missing-rule': 'Missing rule',
  'rule-without-catch-all': 'Rule without catch-all',
  'invalid-rule-cells': 'Invalid rule cells',
  'broken-reference': 'Broken reference',
};

/** Every problem in `file`. Same input, same output and order. */
export function checkDeck(file: SododeckFile): DeckProblems {
  const drafts: Draft[] = [];
  const add = (d: Omit<Draft, 'title'>) => drafts.push({ ...d, title: TITLES[d.kind] });

  const nodeById = new Map<Id, Node>(file.nodes.map((n) => [n.id, n]));
  const nodeTitle = (id: Id) => nodeById.get(id)?.title ?? id;

  checkOrphans(file, add);
  checkDuplicates(file.edges, nodeTitle, add);

  const analyses = new Map<Id, FlowAnalysis>();
  for (const flow of file.flows) {
    const analysis = analyzeFlow(flow, file.edges);
    analyses.set(flow.id, analysis);
    checkFlow(flow, analysis, add);
  }

  for (const [ruleId, rule] of Object.entries(file.rules)) {
    const { catchAll, invalidCells } = ruleChecks(rule);
    const on = [ruleId];
    const target: ProblemTarget = { type: 'rule', ruleId };
    if (!catchAll) {
      add({
        kind: 'rule-without-catch-all',
        ids: on,
        target,
        on,
        detail: `${rule.title} · some inputs match no row`,
        objectTitle: rule.title,
      });
    }
    if (invalidCells.length > 0) {
      const n = invalidCells.length;
      add({
        kind: 'invalid-rule-cells',
        ids: on,
        target,
        on,
        detail: `${rule.title} · ${String(n)} ${n === 1 ? "cell can't" : "cells can't"} be read`,
        objectTitle: rule.title,
      });
    }
  }

  checkReferences(file, analyses, nodeTitle, add);
  return finish(drafts);
}

type Add = (d: Omit<Draft, 'title'>) => void;

function checkOrphans(file: SododeckFile, add: Add): void {
  if (file.nodes.length < 2) return;
  const connected = new Set<Id>();
  for (const e of file.edges) {
    connected.add(e.from);
    connected.add(e.to);
  }
  for (const n of file.nodes) if (n.parent !== undefined) connected.add(n.parent);
  for (const node of file.nodes) {
    if (connected.has(node.id)) continue;
    add({
      kind: 'orphan',
      ids: [node.id],
      target: { type: 'node', id: node.id },
      on: [node.id],
      detail: `${node.title} has no connections`,
      objectTitle: node.title,
    });
  }
}

function checkDuplicates(edges: readonly Edge[], nodeTitle: (id: Id) => string, add: Add): void {
  const groups = new Map<string, Edge[]>();
  for (const edge of edges) {
    if (edge.from === edge.to) continue;
    const key = JSON.stringify([edge.from, edge.to, norm(edge.label)]);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [edge]);
    else group.push(edge);
  }
  for (const group of groups.values()) {
    const first = group[0];
    if (first === undefined || group.length < 2) continue;
    const ids = group.map((e) => e.id);
    const from = nodeTitle(first.from);
    add({
      kind: 'duplicate-connection',
      ids,
      target: { type: 'edges', ids },
      on: ids,
      detail: `${from} → ${nodeTitle(first.to)} appears ${times(group.length)}`,
      objectTitle: from,
    });
  }
}

/** Position of every step on its path, and the step before it (for "doesn't continue from"). */
function pathInfo(analysis: FlowAnalysis): Map<Id, { step: PathStep; previous: PathStep | null }> {
  const info = new Map<Id, { step: PathStep; previous: PathStep | null }>();
  const walk = (steps: readonly PathStep[], before: PathStep | null) => {
    let previous = before;
    for (const step of steps) {
      info.set(step.step.id, { step, previous });
      previous = step;
    }
  };
  walk(analysis.main, null);
  const fork = analysis.main.at(-1) ?? null;
  for (const branch of analysis.branches) walk(branch.steps, fork);
  return info;
}

function checkFlow(flow: Flow, analysis: FlowAnalysis, add: Add): void {
  const info = pathInfo(analysis);
  const order = new Map(flow.steps.map((s, i) => [s.id, i + 1]));
  const letters = new Map(analysis.branches.map((b) => [b.branch.id, b.letter]));
  const base = { on: [flow.id], objectTitle: flow.title };
  const stepTarget = (stepId: Id): ProblemTarget => ({ type: 'flow', flowId: flow.id, stepId });

  for (const p of analysis.problems) {
    switch (p.kind) {
      case 'broken-step': {
        const number = info.get(p.stepId)?.step.number ?? '?';
        add({
          ...base,
          kind: 'step-without-connection',
          ids: [flow.id, p.stepId],
          target: stepTarget(p.stepId),
          detail: `${flow.title} · step ${number} used a deleted connection`,
          order: order.get(p.stepId) ?? 0,
        });
        break;
      }
      case 'chain-break': {
        const at = info.get(p.stepId);
        const number = at?.step.number ?? '?';
        const previous = at?.previous?.number;
        add({
          ...base,
          kind: 'broken-chain',
          ids: [flow.id, p.stepId],
          target: stepTarget(p.stepId),
          detail:
            previous === undefined
              ? `${flow.title} · step ${number} doesn't continue the flow`
              : `${flow.title} · step ${number} doesn't continue from step ${previous}`,
          order: order.get(p.stepId) ?? 0,
        });
        break;
      }
      case 'empty-flow':
        add({
          ...base,
          kind: 'incomplete-flow',
          ids: [flow.id, 'empty'],
          target: { type: 'flow', flowId: flow.id },
          detail: `${flow.title} has no steps`,
        });
        break;
      case 'unknown-branch':
        add({
          ...base,
          kind: 'incomplete-flow',
          ids: [flow.id, p.stepId],
          target: { type: 'flow', flowId: flow.id },
          detail: `${flow.title} · a step belongs to a branch that no longer exists`,
          order: order.get(p.stepId) ?? 0,
        });
        break;
      case 'empty-branch-label':
      case 'empty-branch-condition': {
        const what = p.kind === 'empty-branch-label' ? 'label' : 'condition';
        add({
          ...base,
          kind: 'incomplete-flow',
          ids: [flow.id, p.branchId, what],
          target: { type: 'flow', flowId: flow.id, branchIds: [p.branchId] },
          detail: `${flow.title} · branch ${letters.get(p.branchId) ?? '?'} has no ${what}`,
          order: flow.steps.length + 1,
        });
        break;
      }
    }
  }

  const byCondition = new Map<string, Id[]>();
  for (const branch of flow.branches ?? []) {
    const condition = norm(branch.condition);
    if (condition === '') continue;
    const ids = byCondition.get(condition);
    if (ids === undefined) byCondition.set(condition, [branch.id]);
    else ids.push(branch.id);
  }
  for (const [condition, branchIds] of byCondition) {
    if (branchIds.length < 2) continue;
    const names = branchIds.map((id) => letters.get(id) ?? '?');
    const listed = `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
    add({
      ...base,
      kind: 'overlapping-conditions',
      ids: [flow.id, ...branchIds],
      target: { type: 'flow', flowId: flow.id, branchIds },
      detail: `${flow.title} · branches ${listed} both say "${condition}"`,
      order: flow.steps.length + 1,
    });
  }
}

function checkReferences(
  file: SododeckFile,
  analyses: ReadonlyMap<Id, FlowAnalysis>,
  nodeTitle: (id: Id) => string,
  add: Add,
): void {
  const byId = <T extends { id: Id }>(items: readonly T[]) => new Map(items.map((i) => [i.id, i]));
  const groups = byId(file.groups);
  const edges = byId(file.edges);
  const views = byId(file.views);
  const flows = byId(file.flows);
  const stickies = byId(file.stickies);

  const stepNumber = (flowId: Id, stepId: Id) =>
    analyses.get(flowId)?.byStepId.get(stepId)?.number ??
    String((flows.get(flowId)?.steps.findIndex((s) => s.id === stepId) ?? -1) + 1);

  /** Label, sort title, target and glyph ids of the object holding a reference. */
  const holder = (
    ref: ObjectRef,
  ): { label: string; title: string; target: ProblemTarget; on: Id[] } => {
    switch (ref.scope) {
      case 'nodes': {
        const title = nodeTitle(ref.id);
        return { label: title, title, target: { type: 'node', id: ref.id }, on: [ref.id] };
      }
      case 'edges': {
        const e = edges.get(ref.id);
        const label = e ? `Connection ${nodeTitle(e.from)} → ${nodeTitle(e.to)}` : ref.id;
        return { label, title: label, target: { type: 'edges', ids: [ref.id] }, on: [ref.id] };
      }
      case 'flows': {
        const title = flows.get(ref.id)?.title ?? ref.id;
        const stepId = ref.child?.kind === 'step' ? ref.child.id : undefined;
        return {
          label: stepId === undefined ? title : `${title} · step ${stepNumber(ref.id, stepId)}`,
          title,
          target: { type: 'flow', flowId: ref.id, ...(stepId === undefined ? {} : { stepId }) },
          on: [ref.id],
        };
      }
      case 'groups': {
        const title = groups.get(ref.id)?.title ?? ref.id;
        return { label: `Group "${title}"`, title, target: { type: 'object', ref }, on: [ref.id] };
      }
      case 'views': {
        const title = views.get(ref.id)?.title ?? ref.id;
        return { label: `View "${title}"`, title, target: { type: 'object', ref }, on: [ref.id] };
      }
      case 'stickies': {
        const title = stickyLabel(stickies.get(ref.id)?.text ?? '') ?? 'Untitled note';
        return { label: `Sticky "${title}"`, title, target: { type: 'object', ref }, on: [ref.id] };
      }
      default:
        return { label: ref.id, title: ref.id, target: { type: 'object', ref }, on: [ref.id] };
    }
  };

  for (const p of checkIntegrity(file)) {
    // Reported by analyzeFlow as step-without-connection / incomplete-flow (research R2).
    if (p.object.scope === 'flows' && (p.field === 'edge' || p.field === 'branch')) continue;
    const h = holder(p.object);
    const ids = [p.object.scope, p.object.id, p.object.child?.id ?? '', p.field, p.target];
    const order =
      p.object.scope === 'flows' && p.object.child?.kind === 'step'
        ? (flows.get(p.object.id)?.steps.findIndex((s) => s.id === p.object.child?.id) ?? -1) + 1
        : 0;
    if (p.kind === 'missing-reference' && p.field === 'rules' && p.targetType === 'rule') {
      add({
        kind: 'missing-rule',
        ids,
        target: h.target,
        on: h.on,
        detail: `${h.label} uses a rule that was deleted`,
        objectTitle: h.title,
        order,
      });
      continue;
    }
    add({
      kind: 'broken-reference',
      ids,
      target: h.target,
      on: h.on,
      detail: referenceDetail(p, h.label),
      objectTitle: h.title,
      order,
    });
  }
}

function referenceDetail(p: IntegrityProblem, label: string): string {
  switch (p.kind) {
    case 'cycle':
      return `${label} is inside itself`;
    case 'ambiguous-anchor':
      return `${label} is attached to an id used by several objects`;
    case 'detached-rule-input':
      return `${label} has inputs for a rule it doesn't use`;
    case 'missing-reference': {
      const what = p.targetType === 'object' ? 'something' : `a ${p.targetType.replace('-', ' ')}`;
      return `${label} points to ${what} that was deleted`;
    }
  }
}

function targetIds(target: ProblemTarget): readonly Id[] {
  switch (target.type) {
    case 'node':
      return [target.id];
    case 'edges':
      return target.ids;
    case 'flow':
      return [target.flowId];
    case 'rule':
      return [target.ruleId];
    case 'object':
      return [target.ref.id];
  }
}

const KIND_RANK = new Map(PROBLEM_KINDS.map((k, i) => [k, i]));

function finish(drafts: readonly Draft[]): DeckProblems {
  const seen = new Set<string>();
  const list: Problem[] = [];
  for (const d of drafts) {
    const key = `${d.kind}:${d.ids.join(':')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({
      key,
      kind: d.kind,
      target: d.target,
      title: d.title,
      detail: d.detail,
      objectTitle: d.objectTitle,
      order: d.order ?? 0,
    });
  }
  const on = new Map(drafts.map((d) => [`${d.kind}:${d.ids.join(':')}`, d.on]));
  list.sort(
    (a, b) =>
      (KIND_RANK.get(a.kind) ?? 0) - (KIND_RANK.get(b.kind) ?? 0) ||
      a.objectTitle.localeCompare(b.objectTitle, undefined, { sensitivity: 'base' }) ||
      a.order - b.order ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
  const byObject = new Map<Id, Problem[]>();
  for (const problem of list) {
    for (const id of new Set([...(on.get(problem.key) ?? []), ...targetIds(problem.target)])) {
      const bucket = byObject.get(id);
      if (bucket === undefined) byObject.set(id, [problem]);
      else bucket.push(problem);
    }
  }
  return { list, total: list.length, byObject };
}

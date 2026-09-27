/**
 * Flow paths (006 research R2, ADR 0008): the main path and the branch paths of one flow, with
 * their display numbers (`1…n`, then `4a`, `5a`, `4b`), each step's from/to, broken and
 * chain-break flags, and where each path continues. Pure and JSON-based: runs in a worker or a
 * test without Yjs. Numbers and from/to are derived for display and never stored (FR-038).
 */
import type { Branch, Edge, Flow, Id, Step } from '@sododeck/schema';

export interface PathStep {
  step: Step;
  /** Display number: `3` on the main path, `4a` on alternative "a". */
  number: string;
  /** The branch the step is on, `null` on the main path. */
  branchId: Id | null;
  /** Source node of the step's edge; `null` when the step is broken. */
  from: Id | null;
  to: Id | null;
  /** The step's edge no longer exists (it was deleted). */
  broken: boolean;
  /**
   * The step does not start where the previous non-broken step on its path ended. A step right
   * after a broken one is never flagged: the broken step is the gap (clarification Q2).
   */
  chainBreak: boolean;
}

export interface BranchPath {
  branch: Branch;
  /** `a` for the first alternative, `b` for the second, … */
  letter: string;
  steps: PathStep[];
  /** Node the next step of this branch must start at. */
  nextStart: Id | null;
}

export type FlowProblem =
  | { kind: 'empty-flow' }
  | { kind: 'broken-step' | 'chain-break' | 'unknown-branch'; stepId: Id }
  | { kind: 'empty-branch-label' | 'empty-branch-condition'; branchId: Id };

export interface FlowAnalysis {
  main: PathStep[];
  /**
   * Node the next main-path step must start at: the end of the last non-broken main step, or
   * `null` when there is none (any edge may start the flow).
   */
  nextStart: Id | null;
  /** The last main-path step when the flow has branches (the fork), else `null`. */
  branchStepId: Id | null;
  /** In `flow.branches` order. */
  branches: BranchPath[];
  /** Every step on a path, by id. */
  byStepId: ReadonlyMap<Id, PathStep>;
  /** Chain breaks, broken steps, empty branch fields, an empty flow, unknown branches. */
  problems: FlowProblem[];
  /** At least one step, no chain break, no empty branch label or condition (FR-012). */
  canFinish: boolean;
}

/** `a`…`z`, then `aa`, `ab`, … */
export function branchLetter(index: number): string {
  let n = index;
  let letters = '';
  do {
    letters = String.fromCharCode(97 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letters;
}

const edgeMaps = new WeakMap<readonly Edge[], ReadonlyMap<Id, Edge>>();

/** Edges by id; an array's map is cached, since snapshots keep the array's identity. */
function edgeMap(edges: ReadonlyMap<Id, Edge> | readonly Edge[]): ReadonlyMap<Id, Edge> {
  if (!Array.isArray(edges)) return edges as ReadonlyMap<Id, Edge>;
  const list = edges as readonly Edge[];
  let map = edgeMaps.get(list);
  if (map === undefined) {
    map = new Map(list.map((e) => [e.id, e]));
    edgeMaps.set(list, map);
  }
  return map;
}

/** Walks one path in order, setting from/to, broken and chain-break flags. */
function walkPath(
  steps: readonly Step[],
  numberOf: (position: number) => string,
  branchId: Id | null,
  start: Id | null,
  edges: ReadonlyMap<Id, Edge>,
): { steps: PathStep[]; nextStart: Id | null } {
  let previousTo = start;
  let gap = false;
  const out = steps.map((step, i): PathStep => {
    const edge = edges.get(step.edge);
    if (edge === undefined) {
      gap = true;
      return {
        step,
        number: numberOf(i),
        branchId,
        from: null,
        to: null,
        broken: true,
        chainBreak: false,
      };
    }
    const chainBreak = !gap && previousTo !== null && edge.from !== previousTo;
    previousTo = edge.to;
    gap = false;
    return {
      step,
      number: numberOf(i),
      branchId,
      from: edge.from,
      to: edge.to,
      broken: false,
      chainBreak,
    };
  });
  return { steps: out, nextStart: previousTo };
}

/** Paths, numbers, from/to, broken and chain-break flags of one flow (data-model §2). */
export function analyzeFlow(
  flow: Flow,
  edges: ReadonlyMap<Id, Edge> | readonly Edge[],
): FlowAnalysis {
  const byId = edgeMap(edges);
  const branchList = flow.branches ?? [];
  const known = new Set(branchList.map((b) => b.id));
  const problems: FlowProblem[] = [];

  const mainSteps: Step[] = [];
  const branchSteps = new Map<Id, Step[]>(branchList.map((b) => [b.id, []]));
  const unknown: Step[] = [];
  for (const step of flow.steps) {
    if (step.branch === undefined) mainSteps.push(step);
    else if (known.has(step.branch)) branchSteps.get(step.branch)?.push(step);
    else unknown.push(step);
  }

  const main = walkPath(mainSteps, (i) => String(i + 1), null, null, byId);
  const branches = branchList.map((branch, index): BranchPath => {
    const letter = branchLetter(index);
    const path = walkPath(
      branchSteps.get(branch.id) ?? [],
      (i) => `${String(main.steps.length + i + 1)}${letter}`,
      branch.id,
      main.nextStart,
      byId,
    );
    return { branch, letter, steps: path.steps, nextStart: path.nextStart };
  });

  const onPaths = [...main.steps, ...branches.flatMap((b) => b.steps)];
  if (onPaths.length === 0 && unknown.length === 0) problems.push({ kind: 'empty-flow' });
  for (const s of onPaths) {
    if (s.broken) problems.push({ kind: 'broken-step', stepId: s.step.id });
    if (s.chainBreak) problems.push({ kind: 'chain-break', stepId: s.step.id });
  }
  for (const { id, label, condition } of branchList) {
    if (label.trim() === '') problems.push({ kind: 'empty-branch-label', branchId: id });
    if (condition.trim() === '') problems.push({ kind: 'empty-branch-condition', branchId: id });
  }
  for (const s of unknown) problems.push({ kind: 'unknown-branch', stepId: s.id });

  const blocking = new Set<FlowProblem['kind']>([
    'chain-break',
    'empty-branch-label',
    'empty-branch-condition',
  ]);
  return {
    main: main.steps,
    nextStart: main.nextStart,
    branchStepId: branchList.length > 0 ? (mainSteps.at(-1)?.id ?? null) : null,
    branches,
    byStepId: new Map(onPaths.map((s) => [s.step.id, s])),
    problems,
    canFinish: onPaths.length > 0 && !problems.some((p) => blocking.has(p.kind)),
  };
}

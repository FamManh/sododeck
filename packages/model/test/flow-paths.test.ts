import type { Edge, Flow, Step } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { analyzeFlow } from '../src';

// a → b → c → d → e, plus c → x → y (an error path) and a self-loop on b.
const edges: Edge[] = [
  { id: 'ab', from: 'a', to: 'b' },
  { id: 'bc', from: 'b', to: 'c' },
  { id: 'cd', from: 'c', to: 'd' },
  { id: 'de', from: 'd', to: 'e' },
  { id: 'cx', from: 'c', to: 'x' },
  { id: 'xy', from: 'x', to: 'y' },
  { id: 'bb', from: 'b', to: 'b' },
];

const step = (id: string, edge: string, extra: Partial<Step> = {}): Step => ({
  id,
  edge,
  ...extra,
});
const flow = (steps: Step[], extra: Partial<Flow> = {}): Flow => ({
  id: 'f',
  title: 'Flow',
  steps,
  ...extra,
});

const numbers = (steps: readonly { number: string }[]) => steps.map((s) => s.number);

describe('analyzeFlow: main path', () => {
  it('numbers main steps 1..n and derives from/to through the edge', () => {
    const a = analyzeFlow(flow([step('s1', 'ab'), step('s2', 'bc'), step('s3', 'cd')]), edges);
    expect(numbers(a.main)).toEqual(['1', '2', '3']);
    expect(a.main.map((s) => [s.from, s.to])).toEqual([
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'd'],
    ]);
    expect(a.main.every((s) => !s.broken && !s.chainBreak)).toBe(true);
    expect(a.nextStart).toBe('d');
    expect(a.branchStepId).toBeNull();
    expect(a.branches).toEqual([]);
    expect(a.problems).toEqual([]);
    expect(a.canFinish).toBe(true);
  });

  it('accepts a map of edges as well as an array', () => {
    const byId = new Map(edges.map((e) => [e.id, e]));
    expect(analyzeFlow(flow([step('s1', 'ab')]), byId).nextStart).toBe('b');
  });

  it('has no next start and cannot finish when the flow is empty', () => {
    const a = analyzeFlow(flow([]), edges);
    expect(a.nextStart).toBeNull();
    expect(a.canFinish).toBe(false);
    expect(a.problems).toEqual([{ kind: 'empty-flow' }]);
  });

  it('allows a self-loop and an edge used twice', () => {
    const a = analyzeFlow(flow([step('s1', 'ab'), step('s2', 'bb'), step('s3', 'bb')]), edges);
    expect(a.main.some((s) => s.chainBreak)).toBe(false);
    expect(a.nextStart).toBe('b');
  });

  it('flags a step that does not start where the previous one ended', () => {
    const a = analyzeFlow(flow([step('s1', 'ab'), step('s2', 'cd'), step('s3', 'de')]), edges);
    expect(a.main.map((s) => s.chainBreak)).toEqual([false, true, false]);
    expect(a.problems).toEqual([{ kind: 'chain-break', stepId: 's2' }]);
    expect(a.canFinish).toBe(false);
  });
});

describe('analyzeFlow: broken steps (clarification Q2)', () => {
  it('marks a step whose edge is gone as broken, with no from/to', () => {
    const a = analyzeFlow(flow([step('s1', 'ab'), step('s2', 'gone')]), edges);
    expect(a.main[1]).toMatchObject({ broken: true, from: null, to: null, chainBreak: false });
    expect(a.problems).toEqual([{ kind: 'broken-step', stepId: 's2' }]);
  });

  it('skips broken steps for the next start and never blocks Done', () => {
    const a = analyzeFlow(flow([step('s1', 'ab'), step('s2', 'gone')]), edges);
    expect(a.nextStart).toBe('b');
    expect(a.canFinish).toBe(true);
    expect(analyzeFlow(flow([step('s1', 'gone')]), edges).canFinish).toBe(true);
  });

  it('does not flag the neighbours of a broken step as chain breaks', () => {
    // b → c is gone: s3 starts at c, not at b, but the broken step is the gap.
    const a = analyzeFlow(flow([step('s1', 'ab'), step('s2', 'gone'), step('s3', 'cd')]), edges);
    expect(a.main.map((s) => s.chainBreak)).toEqual([false, false, false]);
    expect(a.canFinish).toBe(true);
  });

  it('compares a step after a broken one with the last non-broken step when they connect', () => {
    const a = analyzeFlow(
      flow([step('s1', 'ab'), step('s2', 'gone'), step('s3', 'bc'), step('s4', 'de')]),
      edges,
    );
    expect(a.main.map((s) => s.chainBreak)).toEqual([false, false, false, true]);
  });
});

describe('analyzeFlow: branches', () => {
  const branched = flow(
    [
      step('s1', 'ab'),
      step('s2', 'bc'),
      step('s3a', 'cd', { branch: 'ok' }),
      step('s4a', 'de', { branch: 'ok' }),
      step('s3b', 'cx', { branch: 'fail' }),
    ],
    {
      branches: [
        { id: 'ok', label: 'payment ok', condition: 'ok' },
        { id: 'fail', label: 'payment failed', condition: 'declined', errorPath: true },
      ],
    },
  );

  it('numbers branch steps after the main path with a letter per alternative', () => {
    const a = analyzeFlow(branched, edges);
    expect(numbers(a.main)).toEqual(['1', '2']);
    expect(a.branches.map((b) => b.letter)).toEqual(['a', 'b']);
    expect(a.branches.map((b) => numbers(b.steps))).toEqual([['3a', '4a'], ['3b']]);
    expect(a.branches.map((b) => b.branch.id)).toEqual(['ok', 'fail']);
  });

  it('derives the branch step and each path next start', () => {
    const a = analyzeFlow(branched, edges);
    expect(a.branchStepId).toBe('s2');
    expect(a.nextStart).toBe('c');
    expect(a.branches.map((b) => b.nextStart)).toEqual(['e', 'x']);
  });

  it('starts an empty branch at the branch step end', () => {
    const a = analyzeFlow(
      flow([step('s1', 'ab')], { branches: [{ id: 'x', label: 'x', condition: 'x' }] }),
      edges,
    );
    expect(a.branches[0]?.nextStart).toBe('b');
    expect(a.branchStepId).toBe('s1');
  });

  it('compares the first step of a branch with the branch step end', () => {
    const a = analyzeFlow(
      flow([step('s1', 'ab'), step('s2a', 'cd', { branch: 'x' })], {
        branches: [{ id: 'x', label: 'x', condition: 'x' }],
      }),
      edges,
    );
    expect(a.branches[0]?.steps[0]?.chainBreak).toBe(true);
    expect(a.problems).toContainEqual({ kind: 'chain-break', stepId: 's2a' });
  });

  it('refuses Done while a branch label or condition is empty', () => {
    const a = analyzeFlow(
      flow([step('s1', 'ab')], {
        branches: [
          { id: 'x', label: '', condition: 'c' },
          { id: 'y', label: 'y', condition: '  ' },
        ],
      }),
      edges,
    );
    expect(a.canFinish).toBe(false);
    expect(a.problems).toEqual([
      { kind: 'empty-branch-label', branchId: 'x' },
      { kind: 'empty-branch-condition', branchId: 'y' },
    ]);
  });

  it('analyzes steps out of normal order by their relative order within each path', () => {
    const a = analyzeFlow(
      flow(
        [
          step('s3a', 'cd', { branch: 'ok' }),
          step('s1', 'ab'),
          step('s3b', 'cx', { branch: 'fail' }),
          step('s2', 'bc'),
          step('s4a', 'de', { branch: 'ok' }),
        ],
        { branches: branched.branches ?? [] },
      ),
      edges,
    );
    expect(a.main.map((s) => s.step.id)).toEqual(['s1', 's2']);
    expect(a.branches.map((b) => b.steps.map((s) => s.step.id))).toEqual([['s3a', 's4a'], ['s3b']]);
    expect(a.problems).toEqual([]);
  });

  it('indexes every step by id with its path', () => {
    const a = analyzeFlow(branched, edges);
    expect(a.byStepId.get('s4a')).toMatchObject({ number: '4a', branchId: 'ok' });
    expect(a.byStepId.get('s1')).toMatchObject({ number: '1', branchId: null });
  });

  it('reports a step naming no branch of the flow and leaves it off every path', () => {
    const a = analyzeFlow(flow([step('s1', 'ab'), step('s2', 'bc', { branch: 'nope' })]), edges);
    expect(numbers(a.main)).toEqual(['1']);
    expect(a.problems).toEqual([{ kind: 'unknown-branch', stepId: 's2' }]);
  });
});

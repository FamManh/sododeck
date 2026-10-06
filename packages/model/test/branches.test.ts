/**
 * Flow branch ops (006, ADR 0008): appendStep, addBranch, updateBranch, removeBranch, the
 * edit-mode checkpoint, moveStep refusals, and their undo steps and removal previews.
 */
import { emptySododeckFile, type Flow, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import {
  analyzeFlow,
  captureFlowStructure,
  createDeckSnapshot,
  createEditor,
  DeckEditError,
  flowStructureChanged,
  fromJSON,
  getObject,
  previewRemoval,
  toJSON,
  type DeckDoc,
} from '../src';
import { expectValid, seqIds } from './helpers';

// a → b → c → d → e, c → x → y.
const base: SododeckFile = {
  ...emptySododeckFile(),
  nodes: ['a', 'b', 'c', 'd', 'e', 'x', 'y'].map((id) => ({
    id,
    type: 'service' as const,
    title: id.toUpperCase(),
  })),
  edges: [
    { id: 'ab', from: 'a', to: 'b' },
    { id: 'bc', from: 'b', to: 'c' },
    { id: 'cd', from: 'c', to: 'd' },
    { id: 'de', from: 'd', to: 'e' },
    { id: 'cx', from: 'c', to: 'x' },
    { id: 'xy', from: 'x', to: 'y' },
  ],
  flows: [
    {
      id: 'f',
      title: 'Place order',
      steps: [
        { id: 's1', edge: 'ab' },
        { id: 's2', edge: 'bc' },
        { id: 's3', edge: 'cd' },
        { id: 's4', edge: 'de' },
      ],
    },
  ],
};

function setup(file: SododeckFile = base) {
  const doc = fromJSON(file);
  const editor = createEditor(doc, { newId: seqIds(), captureTimeout: 10_000 });
  return { doc, editor };
}

const flowOf = (doc: DeckDoc): Flow => {
  const flow = getObject(doc, 'flows', 'f');
  if (flow === undefined) throw new Error('no flow');
  return flow;
};
const shape = (doc: DeckDoc) => flowOf(doc).steps.map((s) => `${s.id}:${s.branch ?? '-'}`);

function expectRefused(doc: DeckDoc, code: DeckEditError['code'], fn: () => unknown): string {
  const before = toJSON(doc);
  let error: unknown;
  try {
    fn();
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(DeckEditError);
  expect((error as DeckEditError).code).toBe(code);
  expect(toJSON(doc)).toEqual(before);
  return (error as DeckEditError).issues.map((i) => i.message).join(' ');
}

describe('appendStep', () => {
  it('appends at the end of the main path, before branch steps', () => {
    const { doc, editor } = setup();
    const { branchId } = editor.addBranch('f', 's2', { label: 'x' });
    // s3, s4 became alternative "a"; the new branch has no step yet.
    const id = editor.appendStep('f', null, { edge: 'bc' });
    expect(shape(doc)).toEqual(['s1:-', 's2:-', `${id}:-`, 's3:branch-0', 's4:branch-0']);
    expect(branchId).toBe('branch-1');
    expectValid(doc);
  });

  it('appends at the end of a given branch, keeping the normal order', () => {
    const { doc, editor } = setup();
    const { branchId } = editor.addBranch('f', 's2', { label: 'x', firstEdge: 'cx' });
    const a = editor.appendStep('f', 'branch-0', { edge: 'de' });
    const b = editor.appendStep('f', branchId, { edge: 'xy' });
    expect(shape(doc)).toEqual([
      's1:-',
      's2:-',
      's3:branch-0',
      's4:branch-0',
      `${a}:branch-0`,
      'step-2:branch-1',
      `${b}:branch-1`,
    ]);
  });

  it('refuses an unknown branch or edge without writing', () => {
    const { doc, editor } = setup();
    expectRefused(doc, 'missing-reference', () => editor.appendStep('f', 'nope', { edge: 'ab' }));
    expectRefused(doc, 'missing-reference', () => editor.appendStep('f', null, { edge: 'nope' }));
  });

  it('is one undo step per call', () => {
    const { doc, editor } = setup();
    editor.appendStep('f', null, { edge: 'ab' });
    editor.appendStep('f', null, { edge: 'bc' });
    editor.undo();
    expect(flowOf(doc).steps).toHaveLength(5);
    editor.undo();
    expect(flowOf(doc).steps).toHaveLength(4);
  });
});

describe('step.branch validation on addStep / updateStep / add flow', () => {
  it('refuses a branch that is not a branch of the flow', () => {
    const { doc, editor } = setup();
    expectRefused(doc, 'missing-reference', () =>
      editor.addStep('f', { edge: 'ab', branch: 'nope' }),
    );
    expectRefused(doc, 'missing-reference', () => {
      editor.updateStep('f', 's1', { branch: 'nope' });
    });
    expectRefused(doc, 'missing-reference', () =>
      editor.add('flows', { title: 'F', steps: [{ id: 'z', edge: 'ab', branch: 'nope' }] }),
    );
  });

  it('accepts a branch of the flow, and a new flow with its own branches', () => {
    const { doc, editor } = setup();
    editor.addBranch('f', 's4', { label: 'x' });
    editor.updateStep('f', 's4', { title: 'still editable' });
    const id = editor.add('flows', {
      title: 'F',
      branches: [{ id: 'bb', label: 'l', condition: 'c' }],
      steps: [
        { id: 'z1', edge: 'ab' },
        { id: 'z2', edge: 'bc', branch: 'bb' },
      ],
    });
    expect(getObject(doc, 'flows', id)?.branches).toHaveLength(1);
    expectValid(doc);
  });

  it('refuses a duplicate branch id and patching branches through update', () => {
    const { doc, editor } = setup();
    editor.addBranch('f', 's4', { label: 'x' });
    expectRefused(doc, 'duplicate-id', () =>
      editor.add('flows', {
        title: 'F',
        branches: [{ id: 'branch-0', label: 'l', condition: 'c' }],
        steps: [],
      }),
    );
    expectRefused(doc, 'invalid', () => {
      editor.update('flows', 'f', { branches: [] } as unknown as { title: string });
    });
  });
});

describe('addBranch (FR-022, FR-029, FR-030)', () => {
  it('splits the following main steps into alternative "a" and appends "b" with its first edge', () => {
    const { doc, editor } = setup();
    const result = editor.addBranch('f', 's2', {
      label: 'payment failed',
      condition: 'declined',
      errorPath: true,
      firstEdge: 'cx',
    });
    expect(result).toEqual({ branchId: 'branch-1', stepId: 'step-2' });
    const flow = flowOf(doc);
    expect(flow.branches).toEqual([
      { id: 'branch-0', label: '', condition: '' },
      { id: 'branch-1', label: 'payment failed', condition: 'declined', errorPath: true },
    ]);
    expect(shape(doc)).toEqual(['s1:-', 's2:-', 's3:branch-0', 's4:branch-0', 'step-2:branch-1']);
    const analysis = analyzeFlow(flow, base.edges);
    expect(analysis.branches.map((b) => b.steps.map((s) => s.number))).toEqual([
      ['3a', '4a'],
      ['3b'],
    ]);
    expect(analysis.canFinish).toBe(false); // "a" needs a label and a condition.
    expectValid(doc);
  });

  it('creates alternative "a" when no main steps follow, then "b" after the branch step', () => {
    const { doc, editor } = setup();
    editor.addBranch('f', 's4', { label: 'first' });
    editor.addBranch('f', 's4', { label: 'second' });
    expect(flowOf(doc).branches?.map((b) => b.label)).toEqual(['first', 'second']);
    expect(shape(doc)).toEqual(['s1:-', 's2:-', 's3:-', 's4:-']);
  });

  it('is one undo step, including the split', () => {
    const { doc, editor } = setup();
    editor.addBranch('f', 's2', { label: 'x', firstEdge: 'cx' });
    editor.undo();
    expect(toJSON(doc)).toEqual(base);
  });

  it('refuses a branch from a branch step, or from an earlier main step once branched', () => {
    const { doc, editor } = setup();
    editor.addBranch('f', 's2', { label: 'x' });
    expect(expectRefused(doc, 'invalid', () => editor.addBranch('f', 's3', {}))).toBe(
      'Branches can only start from the main path.',
    );
    expect(expectRefused(doc, 'invalid', () => editor.addBranch('f', 's1', {}))).toBe(
      'This flow already branches after step 2.',
    );
    expectRefused(doc, 'not-found', () => editor.addBranch('f', 'nope', {}));
    expectRefused(doc, 'missing-reference', () => editor.addBranch('f', 's2', { firstEdge: 'x' }));
  });
});

describe('updateBranch and removeBranch (FR-028)', () => {
  it('edits label, condition and error path, each commit its own undo step', () => {
    const doc = fromJSON(base);
    // Commits on one branch closer than the capture window merge, like any field edit.
    const editor = createEditor(doc, { newId: seqIds(), captureTimeout: 0 });
    const { branchId } = editor.addBranch('f', 's4', { label: 'x' });
    editor.updateBranch('f', branchId, { label: 'payment failed' });
    editor.updateBranch('f', branchId, { condition: 'declined', errorPath: true });
    expect(flowOf(doc).branches?.[0]).toEqual({
      id: branchId,
      label: 'payment failed',
      condition: 'declined',
      errorPath: true,
    });
    editor.updateBranch('f', branchId, { errorPath: null });
    expect(flowOf(doc).branches?.[0]?.errorPath).toBeUndefined();
    editor.undo();
    expect(flowOf(doc).branches?.[0]?.errorPath).toBe(true);
    expectRefused(doc, 'not-found', () => {
      editor.updateBranch('f', 'nope', { label: 'y' });
    });
    expectRefused(doc, 'invalid', () => {
      editor.updateBranch('f', branchId, { label: 3 as unknown as string });
    });
  });

  it('removes a branch with its steps and keeps the others, in one undo step', () => {
    const { doc, editor } = setup();
    const { branchId } = editor.addBranch('f', 's2', { label: 'b', firstEdge: 'cx' });
    const before = toJSON(doc);
    const result = editor.removeBranch('f', 'branch-0');
    expect(result.removed).toEqual([
      { scope: 'flows', id: 'f', child: { kind: 'branch', id: 'branch-0' } },
      { scope: 'flows', id: 'f', child: { kind: 'step', id: 's3' } },
      { scope: 'flows', id: 'f', child: { kind: 'step', id: 's4' } },
    ]);
    expect(flowOf(doc).branches?.map((b) => b.id)).toEqual([branchId]);
    expect(shape(doc)).toEqual(['s1:-', 's2:-', `step-2:${branchId}`]);
    editor.undo();
    expect(toJSON(doc)).toEqual(before);
  });

  it('drops the branches field with the last branch', () => {
    const { doc, editor } = setup();
    const { branchId } = editor.addBranch('f', 's4', { label: 'x' });
    editor.removeBranch('f', branchId);
    expect(flowOf(doc)).not.toHaveProperty('branches');
    expect(toJSON(doc)).toEqual(base);
  });

  it('moves the branch point when the branch step is removed', () => {
    const { doc, editor } = setup();
    editor.addBranch('f', 's4', { label: 'x' });
    editor.removeStep('f', 's4');
    expect(analyzeFlow(flowOf(doc), base.edges).branchStepId).toBe('s3');
  });

  it('lists branches among the children removed with a flow', () => {
    const { editor } = setup();
    const { branchId } = editor.addBranch('f', 's4', { label: 'x' });
    expect(editor.remove('flows', 'f').removed).toContainEqual({
      scope: 'flows',
      id: 'f',
      child: { kind: 'branch', id: branchId },
    });
  });

  it('previews a branch removal with its steps', () => {
    const { doc, editor } = setup();
    editor.addBranch('f', 's2', { label: 'x' });
    const preview = previewRemoval(toJSON(doc), [
      { scope: 'branches', flowId: 'f', id: 'branch-0' },
    ]);
    expect(preview.removed.filter((r) => r.child?.kind === 'step')).toHaveLength(2);
    expect(previewRemoval(toJSON(doc), [{ scope: 'branches', flowId: 'f', id: 'gone' }])).toEqual({
      removed: [],
      updated: [],
      broken: [],
    });
  });
});

describe('moveStep refusals (clarification Q4)', () => {
  it('moves within the main path and within a branch', () => {
    const { doc, editor } = setup();
    editor.moveStep('f', 's1', 1);
    expect(shape(doc).slice(0, 2)).toEqual(['s2:-', 's1:-']);
    editor.addBranch('f', 's1', { label: 'x' });
    // Main path now s2, s1 (s1 is the branch step); s3, s4 are "a".
    editor.moveStep('f', 's4', 2);
    expect(shape(doc)).toEqual(['s2:-', 's1:-', 's4:branch-0', 's3:branch-0']);
  });

  it('refuses a move out of the step path', () => {
    const { doc, editor } = setup();
    editor.addBranch('f', 's2', { label: 'x' });
    expect(
      expectRefused(doc, 'invalid', () => {
        editor.moveStep('f', 's3', 0);
      }),
    ).toBe('Steps can only move within their own path.');
  });

  it('refuses moving the branch step, or a main step after it', () => {
    const { doc, editor } = setup();
    editor.addBranch('f', 's4', { label: 'x' });
    expectRefused(doc, 'invalid', () => {
      editor.moveStep('f', 's4', 0);
    });
    expect(
      expectRefused(doc, 'invalid', () => {
        editor.moveStep('f', 's1', 3);
      }),
    ).toBe('The branch step stays the last step of the main path.');
    editor.moveStep('f', 's1', 2);
    expect(shape(doc)).toEqual(['s2:-', 's3:-', 's1:-', 's4:-']);
  });
});

describe('captureFlowStructure / restoreFlowStructure (clarification Q1)', () => {
  it('removes added steps, brings back removed ones, restores order and membership', () => {
    const { doc, editor } = setup();
    const checkpoint = captureFlowStructure(toJSON(doc), 'f');
    editor.moveStep('f', 's1', 1);
    editor.removeStep('f', 's3');
    editor.appendStep('f', null, { edge: 'de' });
    editor.addBranch('f', 's2', { label: 'x', firstEdge: 'cx' });
    expect(flowStructureChanged(toJSON(doc), checkpoint)).toBe(true);

    editor.restoreFlowStructure('f', checkpoint);
    expect(toJSON(doc)).toEqual(base);
    expect(flowStructureChanged(toJSON(doc), checkpoint)).toBe(false);
  });

  it('keeps the current text of surviving steps and branches', () => {
    const file = structuredClone(base);
    const [flow] = file.flows;
    if (flow === undefined) throw new Error('fixture');
    flow.branches = [{ id: 'ok', label: 'ok', condition: 'c' }];
    flow.steps.push({ id: 's5', edge: 'cx', branch: 'ok' });
    const { doc, editor } = setup(file);
    const checkpoint = captureFlowStructure(toJSON(doc), 'f');
    editor.updateStep('f', 's2', { title: 'Create order', sla: '< 300 ms' });
    editor.updateBranch('f', 'ok', { label: 'payment ok', errorPath: true });
    editor.moveStep('f', 's1', 1);
    editor.removeBranch('f', 'ok');

    editor.restoreFlowStructure('f', checkpoint);
    const restored = flowOf(doc);
    expect(shape(doc)).toEqual(['s1:-', 's2:-', 's3:-', 's4:-', 's5:ok']);
    expect(restored.steps[1]).toEqual({
      id: 's2',
      edge: 'bc',
      title: 'Create order',
      sla: '< 300 ms',
    });
    // The branch was removed in the session, so it comes back as it was captured.
    expect(restored.branches).toEqual([{ id: 'ok', label: 'ok', condition: 'c' }]);
    expectValid(doc);
  });

  it('keeps text edited on a surviving branch', () => {
    const { doc, editor } = setup();
    const { branchId } = editor.addBranch('f', 's4', { label: 'x' });
    const checkpoint = captureFlowStructure(toJSON(doc), 'f');
    editor.updateBranch('f', branchId, { label: 'renamed' });
    editor.appendStep('f', branchId, { edge: 'de' });
    editor.restoreFlowStructure('f', checkpoint);
    expect(flowOf(doc).branches).toEqual([{ id: branchId, label: 'renamed', condition: '' }]);
    expect(flowOf(doc).steps).toHaveLength(4);
  });

  it('brings back a step removed by another tab after the capture', () => {
    const { doc, editor } = setup();
    const checkpoint = captureFlowStructure(toJSON(doc), 'f');
    const other = new Y.Doc();
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));
    createEditor(other).removeStep('f', 's2');
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(other, Y.encodeStateVector(doc)));
    expect(flowOf(doc).steps).toHaveLength(3);

    editor.restoreFlowStructure('f', checkpoint);
    expect(toJSON(doc)).toEqual(base);
  });

  it('is one undo step, and a no-op when nothing structural changed', () => {
    const { doc, editor } = setup();
    const checkpoint = captureFlowStructure(toJSON(doc), 'f');
    editor.moveStep('f', 's1', 1);
    editor.appendStep('f', null, { edge: 'ab' });
    const changed = toJSON(doc);
    editor.restoreFlowStructure('f', checkpoint);
    editor.undo();
    expect(toJSON(doc)).toEqual(changed);

    editor.redo();
    const events: unknown[] = [];
    doc.on('afterTransaction', (t) => events.push(t));
    editor.restoreFlowStructure('f', checkpoint);
    expect(events).toEqual([]);
  });

  it('refuses a checkpoint of another flow and an unknown flow', () => {
    const { doc, editor } = setup();
    editor.add('flows', { id: 'g', title: 'G' });
    const checkpoint = captureFlowStructure(toJSON(doc), 'g');
    expectRefused(doc, 'invalid', () => {
      editor.restoreFlowStructure('f', checkpoint);
    });
    expect(() => captureFlowStructure(toJSON(doc), 'nope')).toThrow(DeckEditError);
  });

  it('is frozen, so the app cannot change it', () => {
    const checkpoint = captureFlowStructure(base, 'f');
    expect(Object.isFrozen(checkpoint)).toBe(true);
    expect(checkpoint.flowId).toBe('f');
  });
});

describe('snapshot stays equal to toJSON through branch ops', () => {
  it('matches after every op', () => {
    const { doc, editor } = setup();
    const snapshot = createDeckSnapshot(doc);
    const check = () => {
      expect(snapshot.get()).toEqual(toJSON(doc));
    };
    const checkpoint = captureFlowStructure(toJSON(doc), 'f');
    const { branchId } = editor.addBranch('f', 's2', { label: 'x', firstEdge: 'cx' });
    check();
    editor.updateBranch('f', branchId, { condition: 'c' });
    check();
    editor.appendStep('f', branchId, { edge: 'xy' });
    check();
    editor.removeBranch('f', 'branch-0');
    check();
    editor.restoreFlowStructure('f', checkpoint);
    check();
    editor.undo();
    check();
    snapshot.destroy();
  });
});

describe('load checks', () => {
  it('refuses a file with a branch id used twice in one flow', () => {
    const file = structuredClone(base);
    const [flow] = file.flows;
    if (flow === undefined) throw new Error('fixture');
    flow.branches = [
      { id: 'dup', label: '', condition: '' },
      { id: 'dup', label: '', condition: '' },
    ];
    expect(() => fromJSON(file)).toThrow(/dup/);
  });
});

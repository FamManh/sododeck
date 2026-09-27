import { createEditor, fromJSON, toJSON, type DeckEditor } from '@sododeck/model';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { branchedDeck, flowDeck } from '../../test/flow-fixtures';
import {
  cancel,
  cancelNeedsConfirm,
  doneBlocker,
  finish,
  recordClick,
  startBranch,
  startEditing,
  startNewFlow,
  undoLastStep,
} from './flow-session';

const initial = useUiStore.getState();
const ui = () => useUiStore.getState();
const session = () => {
  const s = ui().flowSession;
  if (s === null) throw new Error('no session');
  return s;
};

function setup(file = flowDeck): { editor: DeckEditor } {
  useUiStore.setState(initial, true);
  return { editor: createEditor(fromJSON(file), { captureTimeout: 0 }) };
}

describe('recording a new flow (US1)', () => {
  let editor: DeckEditor;
  beforeEach(() => {
    ({ editor } = setup());
    startNewFlow('  Checkout  ', 'delivery');
  });

  it('writes nothing until the first click, which creates the flow and step 1 in one undo step', () => {
    expect(toJSON(editor.doc).flows).toHaveLength(3);
    expect(recordClick(editor, 'ab')?.kind).toBe('create');
    const flow = toJSON(editor.doc).flows.at(-1);
    expect(flow).toMatchObject({ title: 'Checkout', feature: 'delivery', steps: [{ edge: 'ab' }] });
    expect(session().flowId).toBe(flow?.id);
    expect(ui().announcement.text).toBe('Step 1 added: Customer App → API Gateway');
    editor.undo();
    expect(toJSON(editor.doc).flows).toHaveLength(3);
  });

  it('appends contiguous steps, refuses others, and undoes the last step', () => {
    recordClick(editor, 'ab');
    recordClick(editor, 'bc');
    expect(recordClick(editor, 'ab')).toEqual({
      kind: 'invalid',
      stepNumber: '3',
      branchFromStep: null,
    });
    expect(session().invalid).toEqual({ edgeId: 'ab', stepNumber: '3', branchFromStep: null });
    expect(ui().announcement.text).toBe(
      "Can't add Customer App → API Gateway as step 3. It doesn't start at Order Service.",
    );
    recordClick(editor, 'cd');
    expect(session().invalid).toBeNull();
    expect(
      toJSON(editor.doc)
        .flows.at(-1)
        ?.steps.map((s) => s.edge),
    ).toEqual(['ab', 'bc', 'cd']);
    expect(undoLastStep(editor)).toBe(true);
    expect(ui().announcement.text).toBe('Removed step 3');
    expect(
      toJSON(editor.doc)
        .flows.at(-1)
        ?.steps.map((s) => s.edge),
    ).toEqual(['ab', 'bc']);
  });

  it('refuses Done without steps, then saves, shows the flow and returns the toast', () => {
    expect(doneBlocker(toJSON(editor.doc), session())).toBe('Add at least one step first.');
    expect(finish(editor)).toBeNull();
    recordClick(editor, 'ab');
    recordClick(editor, 'bc');
    const id = session().flowId;
    expect(finish(editor)).toBe('Saved flow ‘Checkout’ · 2 steps');
    expect(ui().flowSession).toBeNull();
    expect(ui().activeFlow?.flowId).toBe(id);
  });

  it('cancels without asking when nothing was recorded', () => {
    expect(cancelNeedsConfirm(toJSON(editor.doc), session())).toBe(false);
    cancel(editor);
    expect(ui().flowSession).toBeNull();
    expect(toJSON(editor.doc)).toEqual(flowDeck);
  });

  it('asks, then removes the new flow on Cancel', () => {
    recordClick(editor, 'ab');
    expect(cancelNeedsConfirm(toJSON(editor.doc), session())).toBe(true);
    cancel(editor);
    expect(toJSON(editor.doc)).toEqual(flowDeck);
    expect(ui().announcement.text).toBe('Recording cancelled');
  });
});

describe('edit mode (US3, clarification Q1)', () => {
  it('restores the structure on Cancel and keeps text edits', () => {
    const { editor } = setup();
    startEditing(editor, 'place');
    expect(session()).toMatchObject({ mode: 'edit', flowId: 'place' });
    recordClick(editor, 'cd');
    editor.updateStep('place', 's1', { title: 'Open app' });
    expect(cancelNeedsConfirm(toJSON(editor.doc), session())).toBe(true);
    cancel(editor);
    const flow = toJSON(editor.doc).flows[0];
    expect(flow?.steps.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(flow?.steps[0]?.title).toBe('Open app');
    expect(ui().activeFlow?.flowId).toBe('place');
  });

  it('targets the last branch of a forked flow', () => {
    const { editor } = setup(branchedDeck);
    startEditing(editor, 'pay');
    expect(session().target).toEqual({ kind: 'branch', branchId: 'fail' });
  });
});

describe('branches (US4)', () => {
  it('adds a branch with its first edge and records into it', () => {
    const { editor } = setup();
    startEditing(editor, 'place');
    recordClick(editor, 'cd');
    // bb leaves b, the end of step 1.
    expect(recordClick(editor, 'bb')).toMatchObject({ kind: 'invalid', branchFromStep: 's1' });
    expect(startBranch(editor, 's1', 'bb')).toBe(true);
    const flow = toJSON(editor.doc).flows[0];
    expect(flow?.branches).toHaveLength(2);
    expect(session()).toMatchObject({ addingBranch: true, invalid: null });
    expect(doneBlocker(toJSON(editor.doc), session())).toBe(
      'Every branch needs a label and a condition.',
    );
  });

  it('refuses B on a branch step and on an earlier main step once branched', () => {
    const { editor } = setup(branchedDeck);
    startEditing(editor, 'pay');
    expect(startBranch(editor, 'p3a')).toBe(false);
    expect(ui().announcement.text).toBe('Branches can only start from the main path.');
    expect(startBranch(editor, 'p1')).toBe(false);
    expect(ui().announcement.text).toBe('This flow already branches after step 2.');
  });
});

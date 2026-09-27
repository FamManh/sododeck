import { createEditor } from '@sododeck/model';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { useUiStore } from '../../state/ui-store';
import { flowDeck, playbackDeck } from '../../test/flow-fixtures';
import { editorWrapper } from '../../test/render-canvas';
import { openFlow } from './flow-mode';
import { recordClick, startEditing, startNewFlow } from './flow-session';
import { useFlowSync } from './use-flow-sync';

const ui = () => useUiStore.getState();

function setup(file = flowDeck) {
  const env = editorWrapper(file);
  renderHook(
    () => {
      useFlowSync();
    },
    { wrapper: env.wrapper },
  );
  return env;
}

describe('useFlowSync', () => {
  it('hides a shown flow deleted in another tab', () => {
    const { doc } = setup();
    act(() => {
      ui().setActiveFlow('place');
    });
    const other = new Y.Doc();
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));
    createEditor(other).remove('flows', 'place');
    act(() => {
      Y.applyUpdate(doc, Y.encodeStateAsUpdate(other, Y.encodeStateVector(doc)));
    });
    expect(ui().activeFlow).toBeNull();
  });

  it('ends a session whose flow is deleted, and names it', () => {
    const { editor } = setup();
    act(() => {
      startEditing(editor(), 'place');
    });
    act(() => {
      editor().remove('flows', 'place');
    });
    expect(ui().flowSession).toBeNull();
    expect(ui().announcement.text).toBe('Flow ‘Place order’ was deleted');
  });

  it('drops a selected step that was removed in a session, keeping the flow', () => {
    const { editor } = setup();
    act(() => {
      startEditing(editor(), 'place');
      ui().setActiveStep('s2');
    });
    act(() => {
      editor().removeStep('place', 's2');
    });
    expect(ui().activeFlow).toMatchObject({ flowId: 'place', stepId: null, branchId: null });
  });

  it('keeps a recording session when its own steps change', () => {
    const { editor } = setup();
    act(() => {
      startNewFlow('X', null);
      recordClick(editor(), 'ab');
    });
    act(() => {
      editor().undo();
    });
    // Undo removed the created flow: the session ends.
    expect(ui().flowSession).toBeNull();
  });
});

describe('useFlowSync in flow mode (007)', () => {
  /** Applies a change made in another tab (origin `remote`). */
  function remote(doc: Y.Doc, change: (editor: ReturnType<typeof createEditor>) => void) {
    const other = new Y.Doc();
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));
    change(createEditor(other));
    act(() => {
      Y.applyUpdate(doc, Y.encodeStateAsUpdate(other, Y.encodeStateVector(doc)));
    });
  }

  it('makes the step now at the same index current when the current step is removed', () => {
    const { editor } = setup(playbackDeck);
    act(() => {
      openFlow(editor(), 'order', 'o3');
    });
    act(() => {
      editor().removeStep('order', 'o3');
    });
    expect(ui().activeFlow).toMatchObject({ flowId: 'order', stepId: 'o4' });
  });

  it('falls back to the last step when the last one is removed in another tab', () => {
    const { editor, doc } = setup(playbackDeck);
    act(() => {
      openFlow(editor(), 'order', 'o8');
    });
    remote(doc, (other) => {
      other.removeStep('order', 'o8');
    });
    expect(ui().activeFlow).toMatchObject({ stepId: 'o7' });
  });

  it('clears the current step when the flow becomes empty', () => {
    const { editor } = setup(playbackDeck);
    act(() => {
      openFlow(editor(), 'one');
    });
    act(() => {
      editor().removeStep('one', 'l1');
    });
    expect(ui().activeFlow).toMatchObject({ flowId: 'one', stepId: null });
  });

  it('falls back to the first alternative when the chosen one is removed', () => {
    const { editor, doc } = setup(playbackDeck);
    act(() => {
      openFlow(editor(), 'fork', 'f5b');
    });
    remote(doc, (other) => {
      other.removeBranch('fork', 'failed');
    });
    expect(ui().activeFlow).toMatchObject({ alternativeId: null, stepId: 'f5a' });
  });

  it('leaves flow mode with an announcement and no last-played mark when the flow is deleted', () => {
    const { editor, doc } = setup(playbackDeck);
    act(() => {
      openFlow(editor(), 'order');
    });
    remote(doc, (other) => {
      other.remove('flows', 'order');
    });
    expect(ui().activeFlow).toBeNull();
    expect(ui().lastPlayedFlowId).toBeNull();
    expect(ui().announcement.text).toBe('This flow was deleted');
  });
});

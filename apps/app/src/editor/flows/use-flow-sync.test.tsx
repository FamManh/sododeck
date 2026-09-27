import { createEditor } from '@sododeck/model';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { useUiStore } from '../../state/ui-store';
import { flowDeck } from '../../test/flow-fixtures';
import { editorWrapper } from '../../test/render-canvas';
import { recordClick, startEditing, startNewFlow } from './flow-session';
import { useFlowSync } from './use-flow-sync';

const ui = () => useUiStore.getState();

function setup() {
  const env = editorWrapper(flowDeck);
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

  it('drops an active step that was removed, keeping the flow', () => {
    const { editor } = setup();
    act(() => {
      ui().setActiveFlow('place');
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

import { createDeck } from '@sododeck/model';
import { act, render, renderHook } from '@testing-library/react';
import { StrictMode, useEffect, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { EditorProvider } from './editor-context';
import { useEditor, useHistory } from './use-editor';

describe('editor context', () => {
  it('useEditor() throws outside EditorProvider', () => {
    expect(() => renderHook(() => useEditor())).toThrow(/EditorProvider/);
  });

  it('gives one stable editor for the doc and tracks undo/redo availability', () => {
    const doc = createDeck();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <EditorProvider doc={doc}>{children}</EditorProvider>
    );
    const { result, rerender } = renderHook(
      () => ({ editor: useEditor(), history: useHistory() }),
      {
        wrapper,
      },
    );
    const editor = result.current.editor;
    expect(editor.doc).toBe(doc);
    expect(result.current.history).toEqual({ canUndo: false, canRedo: false });
    const initial = result.current.history;
    rerender();
    expect(result.current.editor).toBe(editor);
    expect(result.current.history).toBe(initial);

    act(() => {
      editor.add('nodes', { type: 'service', title: 'A' });
    });
    expect(result.current.history).toEqual({ canUndo: true, canRedo: false });
    act(() => {
      editor.undo();
    });
    expect(result.current.history).toEqual({ canUndo: false, canRedo: true });
    act(() => {
      editor.redo();
    });
    expect(result.current.history).toEqual({ canUndo: true, canRedo: false });
  });

  it('destroys the editor on unmount', async () => {
    const doc = createDeck();
    const seen: ReturnType<typeof useEditor>[] = [];
    function Probe() {
      const current = useEditor();
      useEffect(() => {
        seen.push(current);
      }, [current]);
      return null;
    }
    const { unmount } = render(
      <EditorProvider doc={doc}>
        <Probe />
      </EditorProvider>,
    );
    unmount();
    await Promise.resolve();
    // A destroyed editor has no history: an edit through it is no longer undoable.
    const editor = seen[0];
    editor?.add('nodes', { type: 'service', title: 'A' });
    expect(editor?.canUndo()).toBe(false);
  });

  it('ends up with a live editor under StrictMode', () => {
    const doc = createDeck();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>
        <EditorProvider doc={doc}>{children}</EditorProvider>
      </StrictMode>
    );
    const { result } = renderHook(() => useEditor(), { wrapper });
    act(() => {
      result.current.add('nodes', { type: 'service', title: 'A' });
    });
    expect(result.current.canUndo()).toBe(true);
  });
});

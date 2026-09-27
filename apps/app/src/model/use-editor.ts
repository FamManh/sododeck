import type { DeckEditor } from '@sododeck/model';
import { createContext, useCallback, useContext, useRef, useSyncExternalStore } from 'react';

/** Provided by `EditorProvider` (editor-context.tsx). */
export const EditorContext = createContext<DeckEditor | null>(null);

/** The deck editor of the surrounding `EditorProvider`. */
export function useEditor(): DeckEditor {
  const editor = useContext(EditorContext);
  if (!editor) throw new Error('useEditor must be used inside <EditorProvider>');
  return editor;
}

export interface History {
  canUndo: boolean;
  canRedo: boolean;
}

/** Undo/redo availability; the returned object changes only when a value changes. */
export function useHistory(): History {
  const editor = useEditor();
  const cache = useRef<History>({ canUndo: editor.canUndo(), canRedo: editor.canRedo() });
  const subscribe = useCallback(
    (listener: () => void) => editor.onHistoryChange(listener),
    [editor],
  );
  const getSnapshot = useCallback(() => {
    const canUndo = editor.canUndo();
    const canRedo = editor.canRedo();
    if (cache.current.canUndo !== canUndo || cache.current.canRedo !== canRedo) {
      cache.current = { canUndo, canRedo };
    }
    return cache.current;
  }, [editor]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

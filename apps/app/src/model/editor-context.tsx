import { createEditor, type DeckDoc, type DeckEditor } from '@sododeck/model';
import { useEffect, useState, type ReactNode } from 'react';

import { EditorContext } from './use-editor';

/** Editors whose unmount is pending; StrictMode's simulated remount takes them back. */
const pendingDestroy = new Set<DeckEditor>();

/**
 * One `DeckEditor` per open deck (003 research R6): every surface writes through it, so there is
 * one undo history. The editor is created once per doc and destroyed on unmount.
 */
export function EditorProvider({ doc, children }: { doc: DeckDoc; children: ReactNode }) {
  const [editor, setEditor] = useState(() => createEditor(doc));
  // A new doc gets a new editor (adjusting state during render, not in an effect).
  if (editor.doc !== doc) setEditor(createEditor(doc));

  useEffect(() => {
    pendingDestroy.delete(editor);
    return () => {
      // Deferred: StrictMode unmounts and remounts synchronously in development, and the
      // remount must keep this editor (and its history) alive.
      pendingDestroy.add(editor);
      queueMicrotask(() => {
        if (pendingDestroy.delete(editor)) editor.destroy();
      });
    };
  }, [editor]);

  return <EditorContext value={editor}>{children}</EditorContext>;
}

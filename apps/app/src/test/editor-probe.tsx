import type { DeckEditor } from '@sododeck/model';
import { useEffect } from 'react';

import { useEditor } from '../model/use-editor';

/** Hands the provider's editor to a test. */
export function EditorProbe({ onEditor }: { onEditor: (editor: DeckEditor) => void }) {
  const editor = useEditor();
  useEffect(() => {
    onEditor(editor);
  }, [editor, onEditor]);
  return null;
}

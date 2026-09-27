import { serializeDeck } from '@sododeck/model';
import { useCallback } from 'react';

import { readDeck } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';
import { downloadText, safeFileName } from '../storage/download';
import { useSaveControls } from './save-context';

/**
 * Downloads the open deck as `<name>.sododeck.json` (FR-025). It reads the live document, not
 * storage, so it still works when saving fails (research R7).
 */
export function useExportDeck(): () => void {
  const editor = useEditor();
  const { markExported } = useSaveControls();
  return useCallback(() => {
    const file = readDeck(editor.doc);
    downloadText(
      `${safeFileName(file.name ?? 'Untitled deck')}.sododeck.json`,
      serializeDeck(file),
    );
    markExported();
  }, [editor, markExported]);
}

import { serializeDeck } from '@sododeck/model';
import { useCallback } from 'react';

import { readPictureBytes } from '../images/read-pictures';
import { usePictureStore } from '../images/picture-store';
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
  const store = usePictureStore();
  return useCallback(() => {
    const file = readDeck(editor.doc);
    // The pictures its images use go into the file (055); a deck without images skips the read.
    void readPictureBytes(store, file).then((pictures) => {
      downloadText(
        `${safeFileName(file.name ?? 'Untitled deck')}.sododeck.json`,
        serializeDeck(file, pictures),
      );
      markExported();
    });
  }, [editor, markExported, store]);
}

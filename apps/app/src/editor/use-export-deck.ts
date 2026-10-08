import { serializeDeck, toMarkdown } from '@sododeck/model';
import { useCallback } from 'react';

import { readPictureBytes } from '../images/read-pictures';
import { usePictureStore } from '../images/picture-store';
import { readDeck } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';
import { deckFileName } from '../storage/download';
import { useSaveFile } from './embed-host-context';
import { useSaveControls } from './save-context';

/**
 * Downloads the open deck as `<name>.sododeck` (FR-025), or as the `<name>.sododeck.md` note for
 * `'markdown'` (070). It reads the live document, not storage, so it still works when saving fails
 * (research R7).
 */
export function useExportDeck(format: 'json' | 'markdown' = 'json'): () => void {
  const editor = useEditor();
  const { markExported } = useSaveControls();
  const store = usePictureStore();
  const saveFile = useSaveFile();
  return useCallback(() => {
    if (saveFile === null) return;
    const file = readDeck(editor.doc);
    // The pictures its images use go into the file (055); a deck without images skips the read.
    void readPictureBytes(store, file).then((pictures) => {
      const json = serializeDeck(file, pictures);
      saveFile(
        deckFileName(file.name ?? 'Untitled deck', format),
        format === 'markdown'
          ? new Blob([toMarkdown(json)], { type: 'text/markdown' })
          : new Blob([json], { type: 'application/json' }),
      );
      markExported();
    });
  }, [editor, format, markExported, saveFile, store]);
}

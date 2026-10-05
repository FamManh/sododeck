import { useToast } from '@sododeck/ui/components/toast';
import { useCallback, type DragEvent } from 'react';

import { diagramType, prepare } from '../import-mermaid/detect';
import { LibraryClientError } from '../storage/library-client';
import { importDeckFile, importedMessage } from './library-actions';
import type { LibraryCommands } from './use-library-commands';

export function importMessage(error: unknown): string {
  if (error instanceof LibraryClientError && error.code === 'unsupported-version') {
    return 'That file was made with a newer version of Sododeck.';
  }
  return 'That file is not a valid .sododeck file. Older .sododeck.json files also open.';
}

/**
 * What a file's text is, by content and never by name (contracts/file-naming.md): JSON starting
 * with `{` is a deck; text with a Mermaid diagram keyword is Mermaid; anything else is neither.
 */
export function kindOfText(text: string): 'deck' | 'mermaid' | 'unknown' {
  const trimmed = text.slice(text.charCodeAt(0) === 0xfeff ? 1 : 0).trimStart();
  if (trimmed.startsWith('{')) return 'deck';
  return diagramType(prepare(text).lines) === 'none' ? 'unknown' : 'mermaid';
}

/**
 * Imports exactly one deck file (`.sododeck`, `.sododeck.json` or `.json`) (FR-023, FR-024): read here, parsed and validated in the
 * library worker, added to `folderId` (or Unfiled). Several files add nothing. Text that is Mermaid goes to
 * `onMermaid` (the library page opens its import dialog on it); without it, it is not a deck.
 */
export function useImportFiles(
  commands: LibraryCommands | null,
  folderId: string | null,
  onMermaid?: (text: string) => void,
) {
  const { toast } = useToast();
  return useCallback(
    async (files: FileList | readonly File[]) => {
      if (!commands || files.length === 0) return;
      const [file] = files;
      if (files.length > 1 || !file) {
        toast({ message: 'Import one file at a time.' });
        return;
      }
      try {
        const text = await file.text();
        if (onMermaid !== undefined && kindOfText(text) === 'mermaid') {
          onMermaid(text);
          return;
        }
        const { name, missingPictures } = await importDeckFile(commands.ctx, text, folderId);
        toast({ message: importedMessage(name, missingPictures) });
      } catch (error) {
        toast({ message: importMessage(error) });
      }
    },
    [commands, folderId, onMermaid, toast],
  );
}

/** Drop handlers for the library's main area. */
export function useFileDrop(onFiles: (files: FileList) => void) {
  return {
    onDragOver: (event: DragEvent) => {
      if (event.dataTransfer.types.includes('Files')) event.preventDefault();
    },
    onDrop: (event: DragEvent) => {
      if (event.dataTransfer.files.length === 0) return;
      event.preventDefault();
      onFiles(event.dataTransfer.files);
    },
  };
}

import { useToast } from '@sododeck/ui/components/toast';
import { useCallback, type DragEvent } from 'react';

import { LibraryClientError } from '../storage/library-client';
import { importDeckFile } from './library-actions';
import type { LibraryCommands } from './use-library-commands';

export function importMessage(error: unknown): string {
  if (error instanceof LibraryClientError && error.code === 'unsupported-version') {
    return 'That file was made with a newer version of Sododeck.';
  }
  return 'That file is not a valid .sododeck file. Older .sododeck.json files also open.';
}

/**
 * Imports exactly one deck file (`.sododeck`, `.sododeck.json` or `.json`) (FR-023, FR-024): read here, parsed and validated in the
 * library worker, added to `folderId` (or Unfiled). Several files add nothing.
 */
export function useImportFiles(commands: LibraryCommands | null, folderId: string | null) {
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
        const name = await importDeckFile(commands.ctx, await file.text(), folderId);
        toast({ message: `Imported "${name}"` });
      } catch (error) {
        toast({ message: importMessage(error) });
      }
    },
    [commands, folderId, toast],
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

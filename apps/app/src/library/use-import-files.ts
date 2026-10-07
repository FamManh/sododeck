import { useToast } from '@sododeck/ui/components/toast';
import { useCallback, type DragEvent } from 'react';

import { diagramType, prepare } from '../import-mermaid/detect';
import { LibraryClientError } from '../storage/library-client';
import { importMessage } from './import-messages';
import type { ImportProblemsRequest } from './import-problems-dialog';
import { importDeckFile, importedMessage, problemCount } from './library-actions';
import type { LibraryCommands } from './use-library-commands';

/**
 * What a file's text is, by content and never by name (contracts/file-naming.md): JSON starting
 * with `{` is a deck; text with a Mermaid diagram keyword is Mermaid; anything else is neither.
 */
export function kindOfText(text: string): 'deck' | 'mermaid' | 'unknown' {
  const trimmed = text.slice(text.charCodeAt(0) === 0xfeff ? 1 : 0).trimStart();
  if (trimmed.startsWith('{')) return 'deck';
  return diagramType(prepare(text).lines) === 'none' ? 'unknown' : 'mermaid';
}

export { importMessage };

export interface ImportFilesOptions {
  /** Text that is Mermaid goes here (the library page opens its import dialog on it). */
  onMermaid?: ((text: string) => void) | undefined;
  /** Opens the import problems dialog (062); without it, refusals fall back to a toast. */
  onProblems?: ((request: ImportProblemsRequest) => void) | undefined;
}

/**
 * Imports exactly one deck file (`.sododeck`, `.sododeck.json` or `.json`) (FR-023, FR-024): read
 * here, parsed and validated in the library worker, added to `folderId` (or Unfiled). Several
 * files add nothing. Text that is Mermaid goes to `onMermaid`; without it, it is not a deck. A
 * refused file opens the import problems dialog; a deck that opens with problems says so in its
 * toast, whose Show opens the dialog (062 US1, US2).
 */
export function useImportFiles(
  commands: LibraryCommands | null,
  folderId: string | null,
  { onMermaid, onProblems }: ImportFilesOptions = {},
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
        const { deckId, name, report } = await importDeckFile(
          commands.ctx,
          text,
          folderId,
          file.name,
        );
        toast({
          message: importedMessage(name, problemCount(report)),
          ...(report === null || onProblems === undefined
            ? {}
            : {
                action: {
                  label: 'Show',
                  onAction: () => {
                    onProblems({ mode: 'opened', name, deckId, report });
                  },
                },
              }),
        });
      } catch (error) {
        if (error instanceof LibraryClientError && error.report && onProblems) {
          onProblems({ mode: 'refused', name: file.name, report: error.report });
          return;
        }
        toast({ message: importMessage(error) });
      }
    },
    [commands, folderId, onMermaid, onProblems, toast],
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

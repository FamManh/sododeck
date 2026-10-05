import { Button } from '@sododeck/ui/components/button';
import { FileUp } from 'lucide-react';
import { useRef } from 'react';

import type { LibraryCommands } from './use-library-commands';
import { useImportFiles } from './use-import-files';

export function ImportButton({
  commands,
  folderId,
  onMermaid,
}: {
  commands: LibraryCommands | null;
  folderId: string | null;
  /** Text of a chosen file that is Mermaid, not a deck. */
  onMermaid?: (text: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const importFiles = useImportFiles(commands, folderId, onMermaid);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".sododeck,.json,application/json"
        hidden
        data-testid="import-input"
        onChange={(event) => {
          const files = event.target.files;
          if (files) void importFiles([...files]);
          event.target.value = '';
        }}
      />
      <Button
        aria-label="Import deck file (.sododeck)"
        disabled={!commands}
        onClick={() => {
          input.current?.click();
        }}
      >
        <FileUp />
        Import
      </Button>
    </>
  );
}

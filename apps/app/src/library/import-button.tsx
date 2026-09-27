import { Button } from '@sododeck/ui/components/button';
import { FileUp } from 'lucide-react';
import { useRef } from 'react';

import type { LibraryCommands } from './use-library-commands';
import { useImportFiles } from './use-import-files';

export function ImportButton({
  commands,
  folderId,
}: {
  commands: LibraryCommands | null;
  folderId: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const importFiles = useImportFiles(commands, folderId);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".json,.sododeck.json,application/json"
        hidden
        data-testid="import-input"
        onChange={(event) => {
          const files = event.target.files;
          if (files) void importFiles([...files]);
          event.target.value = '';
        }}
      />
      <Button
        disabled={!commands}
        onClick={() => {
          input.current?.click();
        }}
      >
        <FileUp />
        Import .sododeck.json
      </Button>
    </>
  );
}

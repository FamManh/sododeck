import { Button } from '@sododeck/ui/components/button';
import { Workflow } from 'lucide-react';

import type { LibraryCommands } from './use-library-commands';

/** Opens the Mermaid import dialog (056); disabled without storage, like Import. */
export function ImportMermaidButton({
  commands,
  onOpen,
}: {
  commands: LibraryCommands | null;
  onOpen: () => void;
}) {
  return (
    <Button disabled={!commands} onClick={onOpen}>
      <Workflow />
      Import Mermaid
    </Button>
  );
}

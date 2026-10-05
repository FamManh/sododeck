import { Button } from '@sododeck/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sododeck/ui/components/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { Ellipsis, FileCode2, Workflow } from 'lucide-react';
import { useRef } from 'react';

import { useUiStore } from '../../state/ui-store';

/**
 * The tools island's ⋯ button: imports into the open deck. "Import Mermaid…" and "Import SQL or
 * DBML…" both default to this deck and offer a new deck instead; focus returns here on close.
 */
export function ToolsMoreMenu() {
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button ref={trigger} variant="ghost" size="icon" aria-label="More">
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>More</TooltipContent>
      </Tooltip>
      <DropdownMenuContent aria-label="More" align="end">
        <DropdownMenuItem
          onSelect={() => {
            useUiStore.getState().openMermaidImport(trigger.current);
          }}
        >
          <Workflow />
          Import Mermaid…
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            useUiStore.getState().openImport(trigger.current);
          }}
        >
          <FileCode2 />
          Import SQL or DBML…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { Button } from '@sododeck/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@sododeck/ui/components/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { Braces, Database, Ellipsis, FileCode2, Workflow } from 'lucide-react';
import { useRef } from 'react';

import { useUiStore } from '../../state/ui-store';
import { shortcutLabel } from './shortcuts';

/**
 * The tools island's ⋯ button: imports into the open deck, then the code views. "Import Mermaid…"
 * and "Import SQL or DBML…" both default to this deck and offer a new deck instead; focus returns
 * here on close. Show JSON (⌘J) and Show DBML / SQL moved here from the ≡ deck menu (founder
 * feedback 2026-10-06); their shortcuts live in `use-shell-shortcuts.ts`, not in this menu.
 */
export function ToolsMoreMenu() {
  const trigger = useRef<HTMLButtonElement>(null);
  const jsonShown = useUiStore((s) => s.jsonShown);
  const codeOpen = useUiStore((s) => s.jsonPanel.codeDrawer.open);
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
        <DropdownMenuSeparator />
        <DropdownMenuItem
          shortcut={shortcutLabel('json')}
          onSelect={() => {
            useUiStore.getState().toggleJsonShown();
          }}
        >
          <Braces />
          {jsonShown ? 'Hide JSON' : 'Show JSON'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            useUiStore.getState().toggleCodeDrawer();
          }}
        >
          <Database />
          {codeOpen ? 'Hide DBML / SQL' : 'Show DBML / SQL'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { Button } from '@sododeck/ui/components/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { Redo2, Undo2 } from 'lucide-react';

import { useEditor, useHistory } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { Island } from './island';
import { shortcutLabel } from './shortcuts';

/** Undo / Redo in their own island, 8 px below the rail (018, design 86). */
export function HistoryIsland() {
  const editor = useEditor();
  const { canUndo, canRedo } = useHistory();
  const announce = useUiStore((s) => s.announce);
  return (
    <Island
      region="history"
      label="History"
      orientation="vertical"
      // Stacked under the rail by the shell's left column.
      className="relative"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={() => {
              if (editor.undo()) announce('Undone');
            }}
          >
            <Undo2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Undo · {shortcutLabel('undo')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Redo"
            disabled={!canRedo}
            onClick={() => {
              if (editor.redo()) announce('Redone');
            }}
          >
            <Redo2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Redo · {shortcutLabel('redo')}</TooltipContent>
      </Tooltip>
    </Island>
  );
}

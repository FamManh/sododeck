import { Button } from '@sododeck/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@sododeck/ui/components/dropdown-menu';
import { Focus, StickyNote, Tag } from 'lucide-react';

import { isFlowMode, useUiStore } from '../state/ui-store';

/** Canvas header, top right (design 02/58): selection count and the Labels toggle. */
export function CanvasToolbar() {
  const count = useUiStore((s) => s.selection.nodes.length + s.selection.edges.length);
  const labelsOn = useUiStore((s) => s.labelsOn);
  const notesDisplay = useUiStore((s) => s.notesDisplay);
  const focusMode = useUiStore((s) => s.focusMode);
  const setLabelsOn = useUiStore((s) => s.setLabelsOn);
  const setNotesDisplay = useUiStore((s) => s.setNotesDisplay);
  const setFocusMode = useUiStore((s) => s.setFocusMode);
  const focusDisabled = useUiStore((s) => s.flowSession !== null || isFlowMode(s));
  const flowMode = useUiStore((s) => isFlowMode(s));

  return (
    <div className="flex items-center gap-2">
      {count >= 2 && (
        <span className="rounded-full bg-primary px-2.5 py-1 text-caption font-medium text-on-primary shadow-rest">
          {count} selected
        </span>
      )}
      <Button
        variant="toggle"
        pressed={labelsOn}
        className="shadow-rest"
        onClick={() => {
          setLabelsOn(!labelsOn);
        }}
      >
        <Tag />
        Labels
      </Button>
      <Button
        variant="toggle"
        pressed={focusMode}
        disabled={focusDisabled}
        title={focusDisabled ? 'Not available while a flow is shown' : 'Focus · F'}
        className="shadow-rest"
        onClick={() => {
          if (!focusDisabled) setFocusMode(!focusMode);
        }}
      >
        <Focus />
        Focus
      </Button>
      {flowMode && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="toggle" className="shadow-rest" aria-haspopup="menu">
              <StickyNote />
              {`Notes: ${notesDisplay}`}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            aria-label="Notes during flows"
            aria-labelledby={undefined}
            align="end"
          >
            <DropdownMenuRadioGroup
              value={notesDisplay}
              onValueChange={(value) => {
                if (value === 'dimmed' || value === 'shown' || value === 'hidden') {
                  setNotesDisplay(value);
                }
              }}
            >
              <DropdownMenuRadioItem value="dimmed">Dimmed</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="shown">Shown</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="hidden">Hidden</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

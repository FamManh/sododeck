import { Button } from '@sododeck/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@sododeck/ui/components/dropdown-menu';
import { StickyNote } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';

/**
 * How sticky notes show while a flow plays: dimmed, shown or hidden (009). It only matters in
 * flow mode, so it lives in the step player, not in the always-visible tools (§g-60).
 */
export function NotesDisplayMenu() {
  const notesDisplay = useUiStore((s) => s.notesDisplay);
  const setNotesDisplay = useUiStore((s) => s.setNotesDisplay);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          aria-haspopup="menu"
          aria-label={`Notes: ${notesDisplay}`}
          title="Notes during flows"
        >
          <StickyNote />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label="Notes during flows" aria-labelledby={undefined} align="end">
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
  );
}

import { Button } from '@sododeck/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sododeck/ui/components/dropdown-menu';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { MoreHorizontal, Trash2 } from 'lucide-react';

/** The ⋯ menu of an index or check card (052): one item, Delete. */
export function PartMenu({
  label,
  deleteLabel,
  onDelete,
  disabled = false,
}: {
  /** Accessible name of the ⋯ button, e.g. "Index options". */
  label: string;
  deleteLabel: string;
  onDelete: () => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} disabled={disabled}>
          <MoreHorizontal aria-hidden strokeWidth={ICON_STROKE_WIDTH} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onDelete}>
          <Trash2 aria-hidden strokeWidth={ICON_STROKE_WIDTH} />
          {deleteLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

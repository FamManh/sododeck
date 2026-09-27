import { Button } from '@sododeck/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sododeck/ui/components/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';

/** A column header's ⋯ menu: Rename and Remove (removal asks nothing; Undo toast, FR-021). */
export function ColumnMenu({
  label,
  onRename,
  onRemove,
}: {
  label: string;
  onRename: () => void;
  onRemove: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Column options for ${label}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>
        <DropdownMenuItem destructive onSelect={onRemove}>
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

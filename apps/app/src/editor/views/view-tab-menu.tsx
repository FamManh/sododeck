import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@sododeck/ui/components/dropdown-menu';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { MoreHorizontal } from 'lucide-react';
import { useId } from 'react';

/**
 * A view tab's menu (011 FR-041–FR-043): Rename, View settings…, Delete view. Opened by the ⋯
 * button (shown on hover and focus), a right-click on the tab, or Shift+F10 / the context-menu
 * key on it; the switcher owns `open`. The last view cannot be deleted, and says why.
 */
export function ViewTabMenu({
  title,
  canDelete,
  open,
  onOpenChange,
  onRename,
  onSettings,
  onDelete,
}: {
  title: string;
  canDelete: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: () => void;
  onSettings: () => void;
  onDelete: () => void;
}) {
  const reasonId = useId();
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`View options for ${title}`}
          tabIndex={-1}
          className={cn(
            'flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-row text-ink-muted opacity-0 transition-opacity group-focus-within/tab:opacity-100 group-hover/tab:opacity-100 hover:bg-surface-3 hover:text-ink data-[state=open]:opacity-100',
            focusRing,
          )}
        >
          <MoreHorizontal aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        aria-label={`${title} view`}
        aria-labelledby={undefined}
        align="start"
        onCloseAutoFocus={(event) => {
          // The switcher moves focus itself (rename field, settings, dialog or the tab).
          event.preventDefault();
        }}
      >
        <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>
        <DropdownMenuItem onSelect={onSettings}>View settings…</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          destructive
          disabled={!canDelete}
          {...(canDelete ? {} : { 'aria-describedby': reasonId })}
          onSelect={onDelete}
          className="flex-col items-start gap-0"
        >
          Delete view
          {!canDelete && (
            <span id={reasonId} className="text-caption text-ink-muted">
              A deck needs at least one view
            </span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

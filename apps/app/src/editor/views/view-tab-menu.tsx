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
import { LayoutGrid, MoreHorizontal } from 'lucide-react';
import { useId } from 'react';

import type { TidyAction } from './tidy-layout-item';

/**
 * A view tab's menu (011 FR-041–FR-043): Rename, View settings…, Delete view, and on the current
 * view Tidy layout (moved from the canvas toolbar by 018, §g-46). Opened by the ⋯
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
  onCloseFocus,
  tidy,
}: {
  title: string;
  canDelete: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: () => void;
  onSettings: () => void;
  onDelete: () => void;
  /** Where focus goes when the menu closes (the switcher: the tab, or the surface it opened). */
  onCloseFocus: () => void;
  /** Only on the current view's tab. */
  tidy?: TidyAction;
}) {
  const reasonId = useId();
  const tidyReasonId = useId();
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
          event.preventDefault();
          onCloseFocus();
        }}
      >
        <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>
        <DropdownMenuItem onSelect={onSettings}>View settings…</DropdownMenuItem>
        {tidy !== undefined && (
          <DropdownMenuItem
            disabled={tidy.block !== null || tidy.running}
            {...(tidy.block === null ? {} : { 'aria-describedby': tidyReasonId })}
            onSelect={tidy.run}
            className="flex-col items-start gap-0"
          >
            <span className="flex items-center gap-2">
              <LayoutGrid aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
              Tidy layout
            </span>
            <span id={tidyReasonId} className="text-caption text-ink-muted">
              {tidy.block ?? 'Arrange this view; pinned components stay'}
            </span>
          </DropdownMenuItem>
        )}
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

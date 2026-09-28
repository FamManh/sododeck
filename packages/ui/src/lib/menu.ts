/**
 * Shared classes of `DropdownMenu` and `ContextMenu` (DESIGN.md menu; design frames 74, 76):
 * a floating card of 32px rows. The highlighted row is raised on surface-2; keyboard focus moves
 * the highlight, so it is visible without a pointer.
 */
export const menuContentClass =
  'z-50 min-w-52 overflow-hidden rounded-card border border-border bg-surface p-1 text-ink shadow-menu outline-none';

export const menuItemClass =
  'relative flex h-8 cursor-pointer items-center gap-2.5 rounded-row px-2.5 text-body outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2 data-[state=open]:bg-surface-2 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-secondary';

/** Destructive rows (Delete…) use clay text and a clay icon, with the word itself as the cue. */
export const menuItemDestructiveClass = 'text-clay-ink [&_svg]:text-clay-ink';

export const menuShortcutClass = 'ml-auto pl-4 text-caption tracking-wide text-ink-secondary';

export const menuSeparatorClass = '-mx-1 my-1 h-px bg-hairline';

export const menuLabelClass = 'px-2.5 py-1.5 text-micro text-ink-secondary uppercase';

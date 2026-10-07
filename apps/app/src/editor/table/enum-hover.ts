/**
 * Hover timing of enum chips (041 R7): the 034 rest and grace delays, one set of timers for the one
 * popover. Resting on a chip opens its values; leaving the chip and the popover closes them after
 * the grace, so moving from the chip into the popover keeps it open.
 */
import { useUiStore, type EnumPopover } from '../../state/ui-store';
import { GRACE_MS, REST_MS } from '../hover-focus/use-hover-focus';
import { cancelDbHover } from './db-hover';

let rest: ReturnType<typeof globalThis.setTimeout> | null = null;
let grace: ReturnType<typeof globalThis.setTimeout> | null = null;

function clear(): void {
  if (rest !== null) globalThis.clearTimeout(rest);
  if (grace !== null) globalThis.clearTimeout(grace);
  rest = null;
  grace = null;
}

/** The pointer entered a chip: open its values after the rest delay. */
export function enterChip(target: Omit<EnumPopover, 'source'>): void {
  clear();
  // The chip's values, never the column popover with them (064 FR-011).
  cancelDbHover();
  const open = useUiStore.getState().enumPopover;
  if (open?.nodeId === target.nodeId && open.columnId === target.columnId) return;
  rest = globalThis.setTimeout(() => {
    rest = null;
    useUiStore.getState().openEnumPopover({ ...target, source: 'hover' });
  }, REST_MS);
}

/** The pointer is over the open popover: keep it. */
export function enterPopover(): void {
  clear();
}

/** The pointer left the chip or the popover: close a hover-opened popover after the grace. */
export function leaveEnum(): void {
  clear();
  grace = globalThis.setTimeout(() => {
    grace = null;
    const ui = useUiStore.getState();
    if (ui.enumPopover?.source === 'hover') ui.closeEnumPopover();
  }, GRACE_MS);
}

/** Opened from the keyboard or a click: no timers left to undo it. */
export function cancelEnumHover(): void {
  clear();
}

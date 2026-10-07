/**
 * Timing of the database note popovers (064, research R2), modelled on the enum chip's
 * (`enum-hover.ts`): resting on a row with hidden information, or on the title of a table with a
 * note, opens its popover; leaving both the target and the popover closes it after a grace, so the
 * pointer can move into the popover. While a hover popover is open, another target of the same
 * table switches at once (FR-006). Touch has no hover (the note icon is tapped instead), and
 * nothing opens while a gesture, a connection, a menu or a row edit owns the canvas (FR-008).
 */
import { useUiStore, type DbPopover } from '../../state/ui-store';
import { dbHoverSuspended } from '../hover-focus/row-suspension';

/** The rest before a popover opens: the tooltip delay, under SC-002's half second. */
export const DB_REST_MS = 300;
/** Leaving the target and the popover closes it after this grace. */
export const DB_GRACE_MS = 150;

export type DbTarget = Omit<DbPopover, 'source'>;

let rest: ReturnType<typeof globalThis.setTimeout> | null = null;
let grace: ReturnType<typeof globalThis.setTimeout> | null = null;
let connecting = false;
/** A press is focusing something: that focus is the pointer's, not a keyboard rest. */
let pressing = false;

function clear(): void {
  if (rest !== null) globalThis.clearTimeout(rest);
  if (grace !== null) globalThis.clearTimeout(grace);
  rest = null;
  grace = null;
}

const blocked = () => dbHoverSuspended(useUiStore.getState(), connecting);

const sameTarget = (a: DbTarget, b: DbTarget) =>
  a.kind === b.kind && a.nodeId === b.nodeId && a.columnId === b.columnId;

// A drag, a connection or a menu starting closes whatever popover is open (FR-007).
useUiStore.subscribe((state, previous) => {
  if (state.dbPopover === null) return;
  if (dbHoverSuspended(state, connecting) && !dbHoverSuspended(previous, connecting)) {
    clear();
    state.closeDbPopover();
  }
});

/** React Flow's connection state, fed by `useHoverFocus` (only its hooks can read it). */
export function setDbHoverConnecting(on: boolean): void {
  if (on === connecting) return;
  connecting = on;
  if (on) {
    clear();
    useUiStore.getState().closeDbPopover();
  }
}

/** A pointer press on the canvas: the focus it causes opens no keyboard popover. */
export function notePointerPress(): void {
  pressing = true;
  globalThis.setTimeout(() => {
    pressing = false;
  }, 0);
}

/**
 * The pointer (or keyboard focus, `pointerType: 'keyboard'`) rests on `target`: open its popover
 * after the rest, or at once when a hover popover of the same table is already showing. The
 * popover itself announces a keyboard open.
 */
export function enterTarget(target: DbTarget, pointerType: string): void {
  clear();
  if (pointerType === 'touch' || blocked()) return;
  if (pointerType === 'keyboard' && pressing) return;
  const source = pointerType === 'keyboard' ? 'keyboard' : 'hover';
  const ui = useUiStore.getState();
  const open = ui.dbPopover;
  if (open !== null && sameTarget(open, target)) return;
  // A popover opened from a note icon stays until it is dismissed; hover never replaces it.
  if (open?.source === 'click') return;
  if (open !== null && open.nodeId === target.nodeId && source === 'hover') {
    ui.openDbPopover({ ...target, source });
    return;
  }
  rest = globalThis.setTimeout(() => {
    rest = null;
    if (blocked()) return;
    const state = useUiStore.getState();
    if (state.dbPopover?.source === 'click') return;
    state.openDbPopover({ ...target, source });
  }, DB_REST_MS);
}

/** The pointer left the target or the popover: close a hover popover after the grace. */
export function leaveTarget(): void {
  clear();
  if (useUiStore.getState().dbPopover?.source !== 'hover') return;
  grace = globalThis.setTimeout(() => {
    grace = null;
    const ui = useUiStore.getState();
    if (ui.dbPopover?.source === 'hover') ui.closeDbPopover();
  }, DB_GRACE_MS);
}

/** Keyboard focus left the target: a keyboard popover closes at once, a pending one never opens. */
export function blurTarget(): void {
  clear();
  const ui = useUiStore.getState();
  if (ui.dbPopover?.source === 'keyboard') ui.closeDbPopover();
}

/** The pointer is over the open popover: keep it. */
export function enterPopover(): void {
  clear();
}

/** A note icon click or an enum chip took over: no timer is left to undo it. */
export function cancelDbHover(): void {
  clear();
}

let hoveredKey: string | null = null;

/**
 * The canvas's delegated pointer-over (064 R2, like 042's rows): finds the row or title under the
 * pointer that has something to show (`data-db-hover`) and enters or leaves it. Rows that are not
 * drawn have no element, so they never open (FR-008). The enum chip keeps its own popover
 * (FR-011); moving inside the open popover changes nothing. `null` means the canvas was left.
 */
export function pointerOver(element: EventTarget | null, pointerType: string): void {
  const el = element instanceof Element ? element : null;
  if (el?.closest('[data-db-popover]') != null) return;
  const found =
    el === null || el.closest('[data-enum-column]') !== null
      ? null
      : el.closest<HTMLElement>('[data-db-hover]');
  const nodeId = found?.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId;
  const columnId = found?.dataset.columnId;
  const target: DbTarget | null =
    found == null || nodeId === undefined
      ? null
      : columnId === undefined
        ? { kind: 'table', nodeId }
        : { kind: 'column', nodeId, columnId };
  const key = target === null ? null : `${target.kind}:${target.nodeId}:${columnId ?? ''}`;
  if (key === hoveredKey) return;
  hoveredKey = key;
  if (target === null) leaveTarget();
  else enterTarget(target, pointerType);
}

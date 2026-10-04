/**
 * One pointer drag of a canvas handle (050 R2): bends, midpoints, connector ends, segments,
 * labels and the weight slider all start here.
 *
 * - Listens on `window` (capture phase), so the drag keeps following the pointer when the pressed
 *   element re-renders, unmounts or is covered, and no handler below can swallow the events.
 *   Pointer capture on the pressed element is best effort only; losing it is not a cancel.
 * - Nothing happens until the pointer has moved `DRAG_THRESHOLD` screen px: below that, release
 *   is a click (`onEnd(e, false)`) and the caller writes nothing.
 * - Moves are throttled to one per animation frame, with the latest pointer; a pending move is
 *   applied before `onEnd`, so the release lands where the pointer is.
 * - Release, `pointercancel`, window `blur`, Esc and `cancel()` (unmount) all run one `finish()`
 *   that removes every listener. `onEnd` or `onCancel` runs exactly once.
 */

/** Screen px the pointer must travel before a press becomes a drag (FR-003). */
export const DRAG_THRESHOLD = 4;

export interface PointerDragHandlers {
  /** The pointer passed the threshold: the drag begins (start the session here, not on press). */
  onStart?(event: PointerEvent): void;
  /** A frame of the drag, with the latest pointer. Only after `onStart`. */
  onMove(event: PointerEvent): void;
  /** Release. `committed` is false for a click (the threshold was never passed). */
  onEnd(event: PointerEvent, committed: boolean): void;
  /** Esc, window blur, `pointercancel` or `cancel()`: drop any preview, write nothing. */
  onCancel(): void;
}

export interface PointerDrag {
  /** Ends the drag without a write (e.g. on unmount). Safe to call more than once. */
  cancel(): void;
}

/** The press that starts a drag: a React `PointerEvent` or a native one. */
export interface PointerPress {
  clientX: number;
  clientY: number;
  pointerId: number;
  currentTarget: EventTarget | null;
}

type Listener = [type: string, listener: (event: Event) => void];

function capture(target: EventTarget | null, pointerId: number): Element | null {
  if (!(target instanceof Element)) return null;
  try {
    target.setPointerCapture(pointerId);
    return target;
  } catch {
    // The pointer may already be gone (synthetic events, a fast release): window listeners suffice.
    return null;
  }
}

function release(target: Element | null, pointerId: number): void {
  if (target === null) return;
  try {
    if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
  } catch {
    // Already released.
  }
}

function frame(callback: () => void): number | null {
  if (typeof requestAnimationFrame !== 'function') {
    callback();
    return null;
  }
  return requestAnimationFrame(callback);
}

/** Starts tracking a press. Call from the handle's `onPointerDown` (primary button only). */
export function startPointerDrag(press: PointerPress, handlers: PointerDragHandlers): PointerDrag {
  const { pointerId } = press;
  const origin = { x: press.clientX, y: press.clientY };
  const captured = capture(press.currentTarget, pointerId);
  let started = false;
  let done = false;
  let pending: PointerEvent | null = null;
  let frameId: number | null = null;

  const isDone = (): boolean => done;
  // Synthetic events in tests may lack a pointer id; treat those as ours.
  const ours = (event: PointerEvent): boolean =>
    typeof event.pointerId !== 'number' || event.pointerId === pointerId;

  function flush(): void {
    frameId = null;
    const event = pending;
    pending = null;
    if (event !== null && !done) handlers.onMove(event);
  }

  function finish(): void {
    done = true;
    pending = null;
    if (frameId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(frameId);
    }
    frameId = null;
    for (const [type, listener] of listeners) window.removeEventListener(type, listener, true);
    release(captured, pointerId);
  }

  function cancel(): void {
    if (done) return;
    finish();
    handlers.onCancel();
  }

  function onMove(event: Event): void {
    const e = event as PointerEvent;
    if (done || !ours(e)) return;
    if (!started) {
      if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) < DRAG_THRESHOLD) return;
      started = true;
      handlers.onStart?.(e);
      // `onStart` may itself cancel the drag (e.g. a refused gesture).
      if (isDone()) return;
    }
    pending = e;
    if (frameId === null) frameId = frame(flush);
  }

  function onUp(event: Event): void {
    const e = event as PointerEvent;
    if (done || !ours(e)) return;
    if (started && pending !== null) {
      if (frameId !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(frameId);
      }
      flush();
    }
    finish();
    handlers.onEnd(e, started);
  }

  function onPointerCancel(event: Event): void {
    if (ours(event as PointerEvent)) cancel();
  }

  // Capture-phase listeners on window also see element blurs (focus moving on press): only the
  // window itself losing focus cancels.
  function onBlur(event: Event): void {
    if (!(event.target instanceof Node)) cancel();
  }

  function onKey(event: Event): void {
    if ((event as KeyboardEvent).key !== 'Escape') return;
    // The drag owns this Esc: the canvas must not also clear the selection with it.
    event.preventDefault();
    event.stopPropagation();
    cancel();
  }

  const listeners: Listener[] = [
    ['pointermove', onMove],
    ['pointerup', onUp],
    ['pointercancel', onPointerCancel],
    ['blur', onBlur],
    ['keydown', onKey],
  ];
  for (const [type, listener] of listeners) window.addEventListener(type, listener, true);

  return { cancel };
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DRAG_THRESHOLD, startPointerDrag, type PointerDragHandlers } from './pointer-drag';

/** Animation frames run only when a test flushes them. */
let frames: FrameRequestCallback[] = [];
function flushFrames(): void {
  const due = frames;
  frames = [];
  for (const cb of due) cb(0);
}

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = [];
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

function pointer(type: string, x: number, y: number, pointerId = 1): PointerEvent {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event as PointerEvent;
}

function handlers() {
  return {
    onStart: vi.fn<(e: PointerEvent) => void>(),
    onMove: vi.fn<(e: PointerEvent) => void>(),
    onEnd: vi.fn<(e: PointerEvent, committed: boolean) => void>(),
    onCancel: vi.fn<() => void>(),
  } satisfies PointerDragHandlers;
}

/** A pressed button at (100, 100), as a handle would be. */
function press(h: PointerDragHandlers) {
  const button = document.createElement('button');
  document.body.append(button);
  const down = pointer('pointerdown', 100, 100);
  Object.defineProperty(down, 'currentTarget', { value: button });
  const drag = startPointerDrag(down, h);
  return { button, drag };
}

const fire = (type: string, x = 0, y = 0, pointerId = 1) => {
  window.dispatchEvent(pointer(type, x, y, pointerId));
};

describe('startPointerDrag (050 R2)', () => {
  it('uses a 4 screen px threshold', () => {
    expect(DRAG_THRESHOLD).toBe(4);
  });

  it('calls neither onStart nor onMove below the threshold', () => {
    const h = handlers();
    press(h);
    fire('pointermove', 102, 102);
    flushFrames();
    expect(h.onStart).not.toHaveBeenCalled();
    expect(h.onMove).not.toHaveBeenCalled();
  });

  it('a press and release below the threshold is a click: onEnd(…, false)', () => {
    const h = handlers();
    press(h);
    fire('pointermove', 103, 100);
    fire('pointerup', 103, 100);
    expect(h.onEnd).toHaveBeenCalledTimes(1);
    expect(h.onEnd.mock.calls[0]?.[1]).toBe(false);
    expect(h.onStart).not.toHaveBeenCalled();
    expect(h.onCancel).not.toHaveBeenCalled();
  });

  it('starts past the threshold, then moves, then ends committed', () => {
    const h = handlers();
    press(h);
    fire('pointermove', 105, 100);
    expect(h.onStart).toHaveBeenCalledTimes(1);
    flushFrames();
    expect(h.onMove).toHaveBeenCalledTimes(1);
    expect(h.onMove.mock.calls[0]?.[0].clientX).toBe(105);
    fire('pointerup', 120, 100);
    expect(h.onEnd).toHaveBeenCalledTimes(1);
    expect(h.onEnd.mock.calls[0]?.[1]).toBe(true);
  });

  it('keeps calling onMove after the pressed element is removed from the DOM', () => {
    const h = handlers();
    const { button } = press(h);
    fire('pointermove', 110, 100);
    flushFrames();
    button.remove();
    fire('pointermove', 140, 100);
    flushFrames();
    fire('pointermove', 200, 150);
    flushFrames();
    expect(h.onMove).toHaveBeenCalledTimes(3);
    expect(h.onMove.mock.calls[2]?.[0].clientX).toBe(200);
  });

  it('throttles moves to one per animation frame, with the latest pointer', () => {
    const h = handlers();
    press(h);
    fire('pointermove', 110, 100);
    fire('pointermove', 120, 100);
    fire('pointermove', 130, 100);
    expect(h.onMove).not.toHaveBeenCalled();
    flushFrames();
    expect(h.onMove).toHaveBeenCalledTimes(1);
    expect(h.onMove.mock.calls[0]?.[0].clientX).toBe(130);
  });

  it('applies a pending move before onEnd', () => {
    const h = handlers();
    press(h);
    fire('pointermove', 150, 100);
    fire('pointerup', 150, 100);
    expect(h.onMove).toHaveBeenCalledTimes(1);
    expect(h.onMove.mock.invocationCallOrder[0]).toBeLessThan(
      h.onEnd.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('ignores other pointers', () => {
    const h = handlers();
    press(h);
    fire('pointermove', 300, 300, 2);
    fire('pointerup', 300, 300, 2);
    expect(h.onStart).not.toHaveBeenCalled();
    expect(h.onEnd).not.toHaveBeenCalled();
  });

  it.each([
    [
      'pointercancel',
      () => {
        fire('pointercancel');
      },
    ],
    ['window blur', () => window.dispatchEvent(new Event('blur'))],
    ['Escape', () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))],
  ])('calls onCancel exactly once on %s', (_name, trigger) => {
    const h = handlers();
    press(h);
    fire('pointermove', 120, 100);
    trigger();
    trigger();
    fire('pointerup', 120, 100);
    expect(h.onCancel).toHaveBeenCalledTimes(1);
    expect(h.onEnd).not.toHaveBeenCalled();
  });

  it('calls onCancel exactly once on cancel(), even when called twice', () => {
    const h = handlers();
    const { drag } = press(h);
    drag.cancel();
    drag.cancel();
    expect(h.onCancel).toHaveBeenCalledTimes(1);
  });

  it('Escape during a drag goes no further (the canvas does not also act on it)', () => {
    const h = handlers();
    press(h);
    const later = vi.fn();
    document.addEventListener('keydown', later, true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    // The first Escape cancelled the drag; only the second, after it, reaches the document.
    expect(later).toHaveBeenCalledTimes(1);
    document.removeEventListener('keydown', later, true);
  });

  it('does not call onMove once cancelled, even with a frame pending', () => {
    const h = handlers();
    const { drag } = press(h);
    fire('pointermove', 150, 100);
    drag.cancel();
    flushFrames();
    expect(h.onMove).not.toHaveBeenCalled();
  });

  it.each([
    [
      'release',
      () => {
        fire('pointerup', 120, 100);
      },
    ],
    [
      'pointercancel',
      () => {
        fire('pointercancel');
      },
    ],
    ['blur', () => window.dispatchEvent(new Event('blur'))],
    [
      'cancel()',
      (drag: { cancel(): void }) => {
        drag.cancel();
      },
    ],
  ])('removes every listener it added on %s', (_name, exit) => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const h = handlers();
    const { drag } = press(h);
    fire('pointermove', 120, 100);
    exit(drag);
    const added = add.mock.calls.map(([type, listener]) => [type, listener]);
    const removed = remove.mock.calls.map(([type, listener]) => [type, listener]);
    expect(added.length).toBeGreaterThan(0);
    for (const pair of added) expect(removed).toContainEqual(pair);
    add.mockRestore();
    remove.mockRestore();
  });
});

describe('startPointerDrag focus changes', () => {
  it('an element losing focus during the drag is not a window blur', () => {
    const h = handlers();
    const { button } = press(h);
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    button.focus();
    expect(h.onCancel).not.toHaveBeenCalled();
  });
});

describe('startPointerDrag without real animation frames', () => {
  it('keeps moving when frames run synchronously', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 7;
    });
    const h = handlers();
    press(h);
    fire('pointermove', 110, 100);
    fire('pointermove', 120, 100);
    fire('pointermove', 130, 100);
    expect(h.onMove).toHaveBeenCalledTimes(3);
  });
});

/**
 * Reordering a short vertical list by grip drag or ⌥↑ / ⌥↓ (006 research R10, FR-001a, FR-020),
 * without a dependency. A list is bounded by its `group` (a feature's flows, one path's steps):
 * moves never leave it, and a drop outside it is refused. `locked` items (the branch step) do not
 * move, and nothing moves after the first of them.
 */
import type { KeyboardEvent, PointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { useUiStore } from '../../state/ui-store';

export interface SortableOptions {
  /** Ids of the list, in order. */
  ids: readonly string[];
  /** Bounds moves; rows of other groups are never drop targets. */
  group: string;
  /** Moves `id` to `position` (0-based, within the group). */
  onMove: (id: string, position: number) => void;
  locked?: (id: string) => boolean;
}

export interface SortableDrag {
  id: string;
  /** Position the row would drop at, or null while outside the group. */
  over: number | null;
}

const ROW_ATTR = 'data-sortable-id';
const GROUP_ATTR = 'data-sortable-group';
/** Distance from the scroll container's edge that auto-scrolls it while dragging. */
const EDGE = 24;

function scrollParent(element: Element | null): Element | null {
  let el = element?.parentElement ?? null;
  while (el !== null) {
    const { overflowY } = getComputedStyle(el);
    if (overflowY === 'auto' || overflowY === 'scroll') return el;
    el = el.parentElement;
  }
  return null;
}

export function useSortableList({ ids, group, onMove, locked }: SortableOptions) {
  const [drag, setDrag] = useState<SortableDrag | null>(null);
  const latest = useRef({ ids, onMove, locked, drag });
  useEffect(() => {
    latest.current = { ids, onMove, locked, drag };
  });

  /** Highest position a row may take: before the first locked row. */
  const limit = (list: readonly string[]) => {
    const firstLocked = list.findIndex((id) => latest.current.locked?.(id) === true);
    return firstLocked === -1 ? list.length - 1 : firstLocked - 1;
  };

  const move = (id: string, position: number): boolean => {
    const list = latest.current.ids;
    const from = list.indexOf(id);
    if (from === -1 || position === from || latest.current.locked?.(id) === true) return false;
    if (position < 0 || position > limit(list)) return false;
    latest.current.onMove(id, position);
    useUiStore
      .getState()
      .announce(`Moved to position ${String(position + 1)} of ${String(list.length)}`);
    return true;
  };

  // Esc cancels a drag wherever focus is.
  useEffect(() => {
    if (drag === null) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setDrag(null);
      }
    };
    document.addEventListener('keydown', onKey, { capture: true });
    return () => {
      document.removeEventListener('keydown', onKey, { capture: true });
    };
  }, [drag]);

  const overAt = (x: number, y: number, id: string): number | null => {
    const row = document.elementFromPoint(x, y)?.closest(`[${ROW_ATTR}]`);
    if (row?.getAttribute(GROUP_ATTR) !== group) return null;
    const target = row.getAttribute(ROW_ATTR) ?? '';
    const position = latest.current.ids.indexOf(target);
    if (position === -1) return null;
    if (target === id) return position;
    return position > limit(latest.current.ids) ? null : position;
  };

  return {
    drag,
    /** Props for a row: its identity and ⌥↑ / ⌥↓. */
    rowProps: (id: string) => ({
      [ROW_ATTR]: id,
      [GROUP_ATTR]: group,
      onKeyDown: (event: KeyboardEvent) => {
        if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
        event.preventDefault();
        event.stopPropagation();
        const from = latest.current.ids.indexOf(id);
        move(id, event.key === 'ArrowUp' ? from - 1 : from + 1);
      },
    }),
    /** Props for a row's grip: pointer drag with a placeholder and auto-scroll. */
    gripProps: (id: string) => ({
      'aria-hidden': true as const,
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (event.button !== 0 || latest.current.locked?.(id) === true) return;
        event.preventDefault();
        // Not in every environment (jsdom); dragging still works without it.
        if ('setPointerCapture' in event.currentTarget) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        setDrag({ id, over: latest.current.ids.indexOf(id) });
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        if (latest.current.drag?.id !== id) return;
        const scroller = scrollParent(event.currentTarget);
        if (scroller !== null) {
          const box = scroller.getBoundingClientRect();
          if (event.clientY < box.top + EDGE) scroller.scrollTop -= EDGE / 2;
          else if (event.clientY > box.bottom - EDGE) scroller.scrollTop += EDGE / 2;
        }
        setDrag({ id, over: overAt(event.clientX, event.clientY, id) });
      },
      onPointerUp: () => {
        const current = latest.current.drag;
        setDrag(null);
        // A drop outside the group (over === null) is refused: the row stays in place.
        if (current?.id === id && current.over !== null) move(id, current.over);
      },
      onPointerCancel: () => {
        setDrag(null);
      },
    }),
  };
}

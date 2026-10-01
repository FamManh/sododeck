/**
 * ⌥(⇧) arrow moves a single selected connection's middle segment (017 R9): 1 px, or 10 px with
 * ⇧, across the segment (perpendicular to its own line). Arrows along the segment, and a
 * connection with no movable segment, still count as handled — they just do nothing — so 016's
 * nudge never runs for an edge-only selection. A burst like the nudge (`createBurst`, T047): one
 * undo step until the keys stop, then an announcement matching the pointer drag
 * (`segment-drag.ts`'s `endSegmentDrag`).
 */
import type { DeckEditor } from '@sododeck/model';
import type { Id } from '@sododeck/schema';
import { useEffect, useMemo } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { cardBox } from '../canvas-geometry';
import type { Level } from '../levels';
import { middleSegment, resolveSides, type MiddleAxis } from '../routing/route-path';
import { readViewState } from '../views/use-current-view';
import { createBurst } from './use-nudge';

const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** -1 / +1 along the segment's own moving axis, or null for an arrow along the segment's line. */
function arrowDelta(axis: MiddleAxis, key: string): number | null {
  if (axis === 'vertical') {
    if (key === 'ArrowUp') return -1;
    if (key === 'ArrowDown') return 1;
    return null;
  }
  if (key === 'ArrowLeft') return -1;
  if (key === 'ArrowRight') return 1;
  return null;
}

function signed(n: number): string {
  const rounded = Math.round(n);
  return rounded >= 0 ? `+${String(rounded)}` : String(rounded);
}

export interface SegmentKeyer {
  /**
   * Handles ⌥(⇧) + arrow. Returns whether this key belongs to the segment move: false for a
   * non-arrow key or a selection that isn't a single connection (016's nudge runs instead).
   */
  key: (
    event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'metaKey' | 'ctrlKey'>,
    level: Level,
  ) => boolean;
  /** Ends the open burst (another key, a pointer down, the idle timer). */
  end: () => void;
}

export function createSegmentKeyer(editor: DeckEditor): SegmentKeyer {
  let edgeId: Id | null = null;
  let offset = 0;
  let pendingDelta = 0;

  const burst = createBurst(
    () => {
      editor.beginGesture();
    },
    () => {
      if (edgeId === null) return;
      offset += pendingDelta;
      editor.setEdgeRoute(edgeId, { offset });
    },
    () => {
      editor.endGesture();
      if (edgeId !== null)
        useUiStore.getState().announce(`Moved middle segment to ${signed(offset)}`);
      edgeId = null;
    },
  );

  const key: SegmentKeyer['key'] = (event, level) => {
    if (!ARROW_KEYS.has(event.key) || event.metaKey || event.ctrlKey) return false;
    const { selection } = useUiStore.getState();
    const onlyOneEdge =
      selection.edges.length === 1 &&
      selection.nodes.length + selection.groups.length + selection.stickies.length === 0;
    if (!onlyOneEdge) return false;

    const view = readViewState(editor.doc);
    const targetEdgeId = selection.edges[0];
    const edge = view.deck.edges.find((e) => e.id === targetEdgeId);
    if (edge === undefined) return true;
    const fromIndex = view.deck.nodes.findIndex((n) => n.id === edge.from);
    const toIndex = view.deck.nodes.findIndex((n) => n.id === edge.to);
    const fromNode = view.deck.nodes[fromIndex];
    const toNode = view.deck.nodes[toIndex];
    if (fromNode === undefined || toNode === undefined) return true;
    const fromBox = cardBox(fromNode, fromIndex, level);
    const toBox = cardBox(toNode, toIndex, level);
    const sides = resolveSides(fromBox, toBox, edge.route);
    const axis = middleSegment(sides);
    if (axis === null) return true;
    const delta = arrowDelta(axis, event.key);
    if (delta === null) return true;

    const step = event.shiftKey ? 10 : 1;
    if (!burst.isOpen() || edgeId !== edge.id) {
      if (burst.isOpen()) burst.end();
      edgeId = edge.id;
      offset = edge.route?.offset ?? 0;
    }
    pendingDelta = delta * step;
    burst.step();
    return true;
  };

  return { key, end: burst.end };
}

/** The canvas's segment keyer; any other key or a pointer down ends its burst. */
export function useSegmentKey(): SegmentKeyer {
  const editor = useEditor();
  const keyer = useMemo(() => createSegmentKeyer(editor), [editor]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (ARROW_KEYS.has(event.key) && event.altKey) return;
      if (['Alt', 'Shift', 'Meta', 'Control'].includes(event.key)) return;
      keyer.end();
    };
    const onPointer = () => {
      keyer.end();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointer, true);
      keyer.end();
    };
  }, [keyer]);
  return keyer;
}

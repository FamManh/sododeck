/**
 * ⌘⇧ arrow resizes the focused or selected component (017 R9/R10): 4 px per press, → / ↓ grow
 * and ← / ↑ shrink, the top-left corner fixed, clamped to `CARD_SIZE_LIMITS`. A burst like 016's
 * nudge (`createBurst`, T047): one undo step until the keys stop, then an announcement matching
 * the pointer resize (`card-resize.ts`'s `endCardResize`).
 */
import type { DeckEditor } from '@sododeck/model';
import type { Id } from '@sododeck/schema';
import { useEffect, useMemo } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { CARD_SIZE_LIMITS } from '../canvas-geometry';
import { createBurst } from './use-nudge';

const RESIZE_ARROWS: Readonly<Record<string, { width: number; height: number }>> = {
  ArrowRight: { width: 1, height: 0 },
  ArrowDown: { width: 0, height: 1 },
  ArrowLeft: { width: -1, height: 0 },
  ArrowUp: { width: 0, height: -1 },
};

/** The component `⌘⇧` + arrow would resize, and its current drawn size. */
export interface ResizeTarget {
  id: Id;
  title: string;
  width: number;
  height: number;
}

export interface ResizeKeyer {
  /** Handles `⌘⇧` + arrow for `target`; returns whether it resized. */
  key: (event: Pick<KeyboardEvent, 'key'>, target: ResizeTarget) => boolean;
  /** Ends the open burst (another key, a pointer down, the idle timer). */
  end: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createResizeKeyer(editor: DeckEditor): ResizeKeyer {
  let nodeId: Id | null = null;
  let title = '';
  let width = 0;
  let height = 0;
  let pending = { width: 0, height: 0 };

  const burst = createBurst(
    () => {
      editor.beginGesture();
    },
    () => {
      if (nodeId === null) return;
      width = clamp(width + pending.width, CARD_SIZE_LIMITS.min.width, CARD_SIZE_LIMITS.max.width);
      height = clamp(
        height + pending.height,
        CARD_SIZE_LIMITS.min.height,
        CARD_SIZE_LIMITS.max.height,
      );
      editor.setCardSize(nodeId, { width, height });
    },
    () => {
      editor.endGesture();
      if (nodeId !== null) {
        useUiStore.getState().announce(`Resized ${title} to ${String(width)} × ${String(height)}`);
      }
      nodeId = null;
    },
  );

  const key: ResizeKeyer['key'] = (event, target) => {
    const direction = RESIZE_ARROWS[event.key];
    if (direction === undefined) return false;
    if (!burst.isOpen() || nodeId !== target.id) {
      if (burst.isOpen()) burst.end();
      nodeId = target.id;
      title = target.title;
      width = target.width;
      height = target.height;
    }
    pending = {
      width: direction.width * CARD_SIZE_LIMITS.step,
      height: direction.height * CARD_SIZE_LIMITS.step,
    };
    burst.step();
    return true;
  };

  return { key, end: burst.end };
}

/** The canvas's resize keyer; any other key or a pointer down ends its burst. */
export function useResizeKey(): ResizeKeyer {
  const editor = useEditor();
  const keyer = useMemo(() => createResizeKeyer(editor), [editor]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key in RESIZE_ARROWS && event.metaKey && event.shiftKey) return;
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

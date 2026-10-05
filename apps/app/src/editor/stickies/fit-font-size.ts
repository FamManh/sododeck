import type { StickyFontSize } from '@sododeck/model';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { MarkdownView } from '@sododeck/ui/components/markdown-view';

/** Descending candidate sizes (px); the first one whose content fits wins (053 R3). */
export const FIT_STEPS: readonly number[] = [32, 28, 24, 20, 18, 16, 14, 12, 11, 10, 9];

/** Sizes offered when the user pins a font size instead of auto-fit. */
export const FIXED_FONT_SIZES: readonly StickyFontSize[] = [12, 14, 16, 20, 24, 32];

export const MIN_FIT_FONT_SIZE = 9;

/** Height of one tag row (px), subtracted from the box before measuring the text. */
export const TAG_ROW_HEIGHT = 24;

/** The paper's padding (12) and border (1) on each side: what the text has less than the box. */
export const NOTE_INSET = 2 * (12 + 1);

export type FitAlign = 'left' | 'center' | 'right';

export interface FitBox {
  text: string;
  width: number;
  height: number;
  align: FitAlign;
  /** A pinned size: fitting is skipped. */
  fontSize?: number | undefined;
}

export interface MeasureRequest {
  text: string;
  width: number;
  fontSize: number;
  align: FitAlign;
}

/** Returns the rendered content height (px) at the requested size. Injected so the fit is pure. */
export type Measure = (request: MeasureRequest) => number;

export interface FitResult {
  fontSize: number;
  /** True when even the minimum size overflows, so the note shows a clip cue. */
  clipped: boolean;
}

// Bounded so a long editing session cannot grow it without limit.
const CACHE_LIMIT = 500;
const cache = new Map<string, FitResult>();

export function clearFitCache(): void {
  cache.clear();
}

const keyOf = (box: FitBox, tagRows: number): string =>
  JSON.stringify([box.text, box.width, box.height, tagRows, box.align]);

/**
 * The result for `box` when it is already known (a pinned size, or measured before), else
 * undefined. A note reads this while rendering, so a note that was fitted once never draws at a
 * stale size for a frame.
 */
export function cachedFit(box: FitBox, tagRows: number): FitResult | undefined {
  if (box.fontSize !== undefined) return { fontSize: box.fontSize, clipped: false };
  return cache.get(keyOf(box, tagRows));
}

export function fitFontSize(measure: Measure, box: FitBox, tagRows: number): FitResult {
  if (box.fontSize !== undefined) return { fontSize: box.fontSize, clipped: false };

  const key = keyOf(box, tagRows);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const available = box.height - tagRows * TAG_ROW_HEIGHT;
  let result: FitResult = { fontSize: MIN_FIT_FONT_SIZE, clipped: true };
  for (const fontSize of FIT_STEPS) {
    const height = measure({ text: box.text, width: box.width, fontSize, align: box.align });
    if (height <= available) {
      result = { fontSize, clipped: false };
      break;
    }
  }

  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, result);
  return result;
}

let host: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

/**
 * Production measurer: renders the note's markdown into one hidden element with the note's width
 * and typography and reads `scrollHeight`. Lists and headings make canvas-only measuring wrong.
 */
export const domMeasurer: Measure = ({ text, width, fontSize, align }) => {
  if (typeof document === 'undefined') return 0;
  if (host === null || root === null) {
    host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText =
      'position:fixed;left:-99999px;top:0;visibility:hidden;pointer-events:none;overflow:hidden;height:0';
    document.body.appendChild(host);
    root = createRoot(host);
  }
  host.style.width = `${width}px`;
  host.style.fontSize = `${fontSize}px`;
  host.style.textAlign = align;
  flushSync(() => {
    root?.render(createElement(MarkdownView, { text, className: 'gap-1 text-[length:inherit]' }));
  });
  return host.scrollHeight;
};

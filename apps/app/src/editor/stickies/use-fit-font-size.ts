import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

import {
  cachedFit,
  fitFontSize,
  MIN_FIT_FONT_SIZE,
  type FitAlign,
  type FitBox,
  type FitResult,
  type Measure,
} from './fit-font-size';

/** What the note shows until its first measurement: never drawn, the layout effect runs before paint. */
const PENDING: FitResult = { fontSize: MIN_FIT_FONT_SIZE, clipped: false };

export interface FitInput {
  text: string;
  /** The content box in px: the note less its padding. */
  width: number;
  height: number;
  align: FitAlign;
  /** A pinned size skips fitting. */
  fontSize: number | undefined;
  /** Rows under the text (tags, status line): subtracted from the height. */
  rows: number;
  /** Changes when `measureRef` moves to another element (the text is being edited). */
  source: string;
}

/**
 * The text size of a note (053 R3): a pinned size as it is, else the largest step whose content
 * fits, measured on `measureRef`: the markdown the note shows (or, while it is edited, a hidden
 * copy of it), which has the note's width and type. Measuring touches only that element's style
 * and layout (never React), so it is safe in a layout effect, and it runs only when the text, box, alignment or rows change, never on pan or zoom.
 * A box measured before is read from the cache while rendering, so it never flashes.
 */
export function useFitFontSize(input: FitInput): {
  fit: FitResult;
  measureRef: RefObject<HTMLDivElement | null>;
} {
  const measureRef = useRef<HTMLDivElement>(null);
  const { text, width, height, align, fontSize, rows, source } = input;
  const box: FitBox = { text, width, height, align, fontSize };
  const known = cachedFit(box, rows);
  const [measured, setMeasured] = useState<FitResult>(known ?? PENDING);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (el === null || fontSize !== undefined) return;
    const measure: Measure = ({ fontSize: size }) => {
      el.style.fontSize = `${String(size)}px`;
      return el.scrollHeight;
    };
    const next = fitFontSize(measure, { text, width, height, align, fontSize }, rows);
    setMeasured((now) =>
      now.fontSize === next.fontSize && now.clipped === next.clipped ? now : next,
    );
  }, [text, width, height, align, fontSize, rows, source]);

  return { fit: known ?? measured, measureRef };
}

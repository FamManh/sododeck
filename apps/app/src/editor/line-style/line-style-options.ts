/** The choices of the Line style controls (022): shared by the popover, drawer and menu. */
import type { Dash, Width } from '@sododeck/model';

export const DASHES: readonly { value: Dash; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

/** The five weight stops, thinnest first (the default is 2). */
export const WIDTHS: readonly Width[] = [1, 1.5, 2, 3, 4];
export const DEFAULT_WIDTH: Width = 2;

export const widthText = (width: number): string => `${String(width)} px`;

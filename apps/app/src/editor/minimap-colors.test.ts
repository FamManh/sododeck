import { describe, expect, it } from 'vitest';

import type { CanvasFlowNode } from './deck-to-flow';
import { minimapFill, minimapStroke } from './minimap-colors';

const node = (type: string, data: Record<string, unknown>) => ({ type, data }) as CanvasFlowNode;

describe('minimap colours (053)', () => {
  it('keeps a card or group look', () => {
    const look = { fill: 'var(--x-fill)', stroke: 'var(--x-stroke)' };
    expect(minimapFill(node('deck', { look }))).toBe('var(--x-fill)');
    expect(minimapStroke(node('deck', { look }))).toBe('var(--x-stroke)');
  });

  it('falls back to neutral surface tokens when there is no look', () => {
    expect(minimapFill(node('deck', {}))).toBe('var(--color-surface-3)');
    expect(minimapStroke(node('deck', {}))).toBe('var(--color-border-strong)');
  });

  it('draws a note in its own paper colour, amber by default', () => {
    expect(minimapFill(node('sticky', { color: 'blue' }))).toBe('var(--color-blue-soft)');
    expect(minimapStroke(node('sticky', { color: 'blue' }))).toBe('var(--color-blue-ink)');
    expect(minimapFill(node('sticky', {}))).toBe('var(--color-amber-soft)');
  });
});

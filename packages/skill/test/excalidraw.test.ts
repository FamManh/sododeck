import { describe, expect, it } from 'vitest';

import { outlineExcalidraw, outlineText } from '../src/excalidraw';

const shape = (id: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'rectangle',
  x,
  y,
  width: 200,
  height: 80,
  backgroundColor: '#dbeafe',
  ...extra,
});
const text = (
  id: string,
  x: number,
  y: number,
  value: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  type: 'text',
  x,
  y,
  width: 120,
  height: 20,
  text: value,
  fontSize: 16,
  ...extra,
});

function board(offsetX = 0) {
  return [
    text(`title${String(offsetX)}`, offsetX, 0, offsetX === 0 ? 'Checkout flow' : 'Other board', {
      fontSize: 36,
    }),
    ...Array.from({ length: 8 }, (_, i) => [
      shape(`s${String(offsetX)}-${String(i)}`, offsetX + i * 250, 100),
      text(`l${String(offsetX)}-${String(i)}`, offsetX + i * 250, 120, `Step ${String(i)}`, {
        containerId: `s${String(offsetX)}-${String(i)}`,
      }),
    ]).flat(),
  ];
}

describe('whiteboard outline (027 from-diagrams)', () => {
  it('reads bound labels, overlaid labels and arrows with bound or nearby ends', () => {
    const doc = {
      elements: [
        shape('web', 0, 100),
        text('web-label', 10, 120, 'Web shop', { containerId: 'web' }),
        shape('api', 400, 100, { type: 'diamond' }),
        text('api-label', 440, 130, 'intent ?'),
        shape('db', 800, 100),
        text('db-label', 840, 130, 'Orders DB'),
        {
          id: 'a1',
          type: 'arrow',
          x: 200,
          y: 140,
          width: 200,
          height: 0,
          points: [
            [0, 0],
            [200, 0],
          ],
          startBinding: { elementId: 'web' },
          endBinding: { elementId: 'api' },
        },
        text('a1-label', 260, 120, 'POST /checkout', { containerId: 'a1' }),
        {
          id: 'a2',
          type: 'arrow',
          x: 610,
          y: 140,
          width: 180,
          height: 0,
          points: [
            [0, 0],
            [185, 0],
          ],
        },
        text('note', 0, 400, 'Retries 3 times'),
        text('tiny', 0, 500, 'scribble', { fontSize: 10 }),
        { id: 'gone', type: 'rectangle', x: 0, y: 0, isDeleted: true },
      ],
    };
    const outline = outlineExcalidraw(doc);
    expect(outline.shapes.map((s) => `${s.kind}:${s.label}`)).toEqual([
      'rectangle:Web shop',
      'diamond:intent ?',
      'rectangle:Orders DB',
    ]);
    expect(outline.arrows).toEqual([
      { id: 'a1', from: 'web', to: 'api', label: 'POST /checkout' },
      { id: 'a2', from: 'api', to: 'db', guessed: true },
    ]);
    expect(outline.texts.map((t) => t.text)).toEqual(['Retries 3 times']);
    expect(outline.counts.skipped).toBe(1);
    const plain = outlineText(outline);
    expect(plain).toContain('"Web shop" → "intent ?" "POST /checkout"');
    expect(plain).toContain('"intent ?" → "Orders DB" (end guessed)');
  });

  it('finds boards by their large one-line titles and keeps only the asked one', () => {
    const doc = {
      elements: [
        ...board(0),
        ...board(3000),
        text('scribble', 0, 600, 'a long\nhand-written note', { fontSize: 36 }),
      ],
    };
    const all = outlineExcalidraw(doc);
    expect(all.boards.map((b) => b.title)).toEqual(['Checkout flow', 'Other board']);
    expect(all.boards[0]?.width).toBe(3000);
    const one = outlineExcalidraw(doc, { board: 'other' });
    expect(one.boards.map((b) => b.title)).toEqual(['Other board']);
    expect(one.shapes.every((s) => s.x >= 3000)).toBe(true);
  });

  it('survives input that is not a whiteboard', () => {
    expect(outlineExcalidraw(null).counts).toEqual({ shapes: 0, arrows: 0, texts: 0, skipped: 0 });
    expect(outlineExcalidraw({ elements: [1, 'x', {}] }).counts.skipped).toBe(3);
  });
});

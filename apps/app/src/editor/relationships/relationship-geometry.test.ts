import { describe, expect, it } from 'vitest';

import { relationshipGeometry, type RelationshipGeometryInput } from './relationship-geometry';

const base: RelationshipGeometryInput = {
  ends: {
    from: { offsets: [82], kind: 'row', mark: 'zero-many' },
    to: { offsets: [82], kind: 'row', mark: 'one' },
  },
  rows: true,
  self: false,
  notation: 'crow',
  hideEnds: false,
  fromBox: { x: 0, y: 0, width: 240, height: 200 },
  toBox: { x: 400, y: 100, width: 240, height: 200 },
  shape: 'curved',
  sides: ['right', 'left'],
};

describe('relationshipGeometry (042)', () => {
  it('anchors on the rows of the facing sides with crow marks', () => {
    const geometry = relationshipGeometry(base);
    expect(geometry.sides).toEqual({ from: 'right', to: 'left' });
    expect(geometry.path.startsWith('M 240 82 L 264 82')).toBe(true);
    expect(geometry.path.endsWith('L 400 182')).toBe(true);
    expect(geometry.marks).toEqual([
      { kind: 'crow', end: 'zero-many', at: { x: 240, y: 82 }, u: { x: 1, y: 0 } },
      { kind: 'crow', end: 'one', at: { x: 400, y: 182 }, u: { x: -1, y: 0 } },
    ]);
  });

  it('switches sides when the tables swap', () => {
    const geometry = relationshipGeometry({
      ...base,
      fromBox: { ...base.fromBox, x: 800 },
    });
    expect(geometry.sides).toEqual({ from: 'left', to: 'right' });
    expect(geometry.start).toEqual({ x: 800, y: 82 });
  });

  it('draws plain ends with ends hidden or no cardinality, text marks in 1 / n', () => {
    expect(relationshipGeometry({ ...base, hideEnds: true }).marks).toEqual([]);
    const plain = relationshipGeometry({
      ...base,
      ends: { from: { offsets: [82], kind: 'row' }, to: { offsets: [82], kind: 'row' } },
    });
    expect(plain.marks).toEqual([]);
    const numeric = relationshipGeometry({ ...base, notation: 'numeric' });
    expect(numeric.marks.map((mark) => mark.kind === 'card-text' && mark.text)).toEqual([
      '0..n',
      '1',
    ]);
  });

  it('loops a self-reference on the right side', () => {
    const geometry = relationshipGeometry({
      ...base,
      self: true,
      toBox: base.fromBox,
      ends: { ...base.ends, to: { offsets: [58], kind: 'row', mark: 'one' } },
    });
    expect(geometry.sides).toEqual({ from: 'right', to: 'right' });
    expect(geometry.label.x).toBe(296);
  });

  it('runs on the outline below 90 %, marks kept and no arrow', () => {
    const geometry = relationshipGeometry({ ...base, rows: false });
    expect(geometry.sides).toBeUndefined();
    expect(geometry.start).toEqual({ x: 240, y: 100 });
    expect(geometry.end).toEqual({ x: 400, y: 200 });
    expect(geometry.marks.map((mark) => mark.kind)).toEqual(['crow', 'crow']);
    expect(geometry.marks[1]).toMatchObject({ u: { x: -1, y: -0 } });
  });
});

import { describe, expect, it } from 'vitest';

import { fixedWidthMeasurer } from '../export/text-measure';
import type { TableContext } from '../table-keys';
import { tableLayout, type TableNode } from '../table-layout';
import {
  endOf,
  isRelationship,
  relationshipEnds,
  relationshipSides,
  sameEnds,
} from './relationship-ends';

const box = (x: number, y = 0, width = 240, height = 200) => ({ x, y, width, height });

describe('relationshipSides (042 R3)', () => {
  it('uses the facing sides both ways', () => {
    expect(relationshipSides(box(0), box(400))).toEqual({ from: 'right', to: 'left' });
    expect(relationshipSides(box(400), box(0))).toEqual({ from: 'left', to: 'right' });
    expect(relationshipSides(box(0), box(240))).toEqual({ from: 'right', to: 'left' });
  });

  it('uses one shared side, the shorter one, when the boxes overlap horizontally', () => {
    expect(relationshipSides(box(0), box(100, 400, 300))).toEqual({ from: 'left', to: 'left' });
    expect(relationshipSides(box(0), box(100, 400))).toEqual({ from: 'right', to: 'right' });
    expect(relationshipSides(box(100), box(0, 400, 400))).toEqual({ from: 'right', to: 'right' });
    expect(relationshipSides(box(0), box(0, 400))).toEqual({ from: 'right', to: 'right' });
  });

  it('uses right / right for a self-reference', () => {
    expect(relationshipSides(box(0), box(0), true)).toEqual({ from: 'right', to: 'right' });
  });
});

describe('endOf (042 R7)', () => {
  const cases = [
    ['1-1', 'one', 'one'],
    ['1-n', 'one', 'one-many'],
    ['n-1', 'one-many', 'one'],
    ['n-n', 'one-many', 'one-many'],
  ] as const;
  it.each(cases)('%s reads the from and to letters', (cardinality, from, to) => {
    expect(endOf(cardinality, 'from', false)).toBe(from);
    expect(endOf(cardinality, 'to', undefined)).toBe(to);
  });

  it('turns optional sides into zero-one and zero-many', () => {
    expect(endOf('n-1', 'from', true)).toBe('zero-many');
    expect(endOf('n-1', 'to', true)).toBe('zero-one');
  });

  it('has no mark without a cardinality', () => {
    expect(endOf(undefined, 'from', true)).toBeUndefined();
  });
});

describe('isRelationship (042)', () => {
  const tables = new Set(['a', 'b']);
  const isTable = (id: string) => tables.has(id);
  it('needs two tables and column ends or a cardinality', () => {
    expect(isRelationship({ from: 'a', to: 'b', fromColumns: ['x'] }, isTable)).toBe(true);
    expect(isRelationship({ from: 'a', to: 'a', toColumns: ['x'] }, isTable)).toBe(true);
    expect(isRelationship({ from: 'a', to: 'b', cardinality: 'n-1' }, isTable)).toBe(true);
    expect(isRelationship({ from: 'a', to: 'b' }, isTable)).toBe(false);
    expect(isRelationship({ from: 'a', to: 's', fromColumns: ['x'] }, isTable)).toBe(false);
    expect(isRelationship({ from: 's', to: 't', cardinality: '1-1' }, isTable)).toBe(false);
  });
});

describe('relationshipEnds (042 R2, R5)', () => {
  const measure = fixedWidthMeasurer(0.6);
  const context = (detail: 'all' | 'keys' | 'names'): TableContext => ({
    fk: new Map([['t', new Set(['c2', 'c3'])]]),
    showSchema: false,
    enums: new Map(),
    display: {
      detail,
      hideTypes: false,
      hideNullable: false,
      hideNotes: false,
      hideIndexes: false,
    },
  });
  const table: TableNode = {
    id: 't',
    title: 't',
    columns: ['c1', 'c2', 'c3', 'c4', 'c5'].map((id, i) => ({
      id,
      name: id,
      type: 'int',
      ...(i === 0 ? { pk: true } : {}),
    })),
  };
  const all = tableLayout(table, context('all'), 240, measure);
  const keys = tableLayout(table, context('keys'), 240, measure);
  const names = tableLayout(table, context('names'), 240, measure);
  // 12 + 24 + 8 + 18 + 8, then 24 per row; centre at +12.
  const row = (i: number) => 70 + 24 * i + 12;

  it('anchors a single column on its row, with marks from the cardinality', () => {
    const ends = relationshipEnds(
      {
        fromColumns: ['c2'],
        toColumns: ['c1'],
        cardinality: 'n-1',
        fromOptional: true,
      },
      all,
      all,
    );
    expect(ends.from).toEqual({ offsets: [row(1)], kind: 'row', mark: 'zero-many' });
    expect(ends.to).toEqual({ offsets: [row(0)], kind: 'row', mark: 'one' });
  });

  it('keeps every visible composite member, and falls back to one end with one visible', () => {
    const composite = { fromColumns: ['c2', 'c3'], toColumns: ['c4', 'c5'] };
    expect(relationshipEnds(composite, all, all).from.offsets).toEqual([row(1), row(2)]);
    expect(relationshipEnds(composite, keys, keys).from.offsets).toEqual([row(1), row(2)]);
    // At Keys c4 and c5 are hidden: the end meets the "+n" pill.
    expect(relationshipEnds(composite, keys, keys).to).toEqual({
      offsets: [70 + 3 * 24 + 6 + 12],
      kind: 'pill',
    });
    expect(
      relationshipEnds({ fromColumns: ['c2', 'c4'], toColumns: ['c1'] }, keys, keys).from,
    ).toEqual({ offsets: [row(1)], kind: 'row' });
  });

  it('draws what exists for mismatched composite lengths', () => {
    const ends = relationshipEnds({ fromColumns: ['c2', 'c3', 'c4'], toColumns: ['c1'] }, all, all);
    expect(ends.from.offsets).toHaveLength(3);
    expect(ends.to.offsets).toHaveLength(1);
  });

  it('uses the title at Names and for a missing column, the outline without columns', () => {
    expect(relationshipEnds({ fromColumns: ['c2'] }, names, names).from).toEqual({
      offsets: [53],
      kind: 'title',
    });
    expect(relationshipEnds({ fromColumns: ['gone'] }, all, all).from.kind).toBe('title');
    expect(relationshipEnds({ fromColumns: ['c2'] }, all, all).to).toEqual({
      offsets: [],
      kind: 'outline',
    });
  });

  it('compares ends by value', () => {
    const a = relationshipEnds({ fromColumns: ['c2'], toColumns: ['c1'] }, all, all);
    const b = relationshipEnds({ fromColumns: ['c2'], toColumns: ['c1'] }, all, all);
    expect(sameEnds(a, b)).toBe(true);
    expect(sameEnds(a, relationshipEnds({ fromColumns: ['c3'] }, all, all))).toBe(false);
    expect(sameEnds(undefined, a)).toBe(false);
  });
});

/** Words the table card says (041): row labels for assistive tech and detail names. */
import type { DbDetail } from '@sododeck/schema';

import type { KeyGlyph, TableRow } from '../table-layout';

export const GLYPH_NAMES: Record<KeyGlyph, string> = {
  pk: 'Primary key',
  fk: 'Foreign key',
  unique: 'Unique',
};

/** What assistive tech reads for a row (FR-023): name, type, keys, nullable, in that order. */
export function rowLabel(row: TableRow): string {
  return [
    row.name,
    row.enum?.name ?? row.type,
    ...row.glyphs.map((glyph) => GLYPH_NAMES[glyph].toLowerCase()),
    row.nullable ? 'nullable' : undefined,
  ]
    .filter((part) => part !== undefined)
    .join(', ');
}

export const DETAIL_NAMES: Record<DbDetail, string> = {
  names: 'Names',
  keys: 'Keys',
  all: 'All',
};

/** The header toggle's cycle (041 FR-015): deck setting → Keys → All → deck setting. */
export function nextDetail(own: DbDetail | undefined): DbDetail | undefined {
  if (own === undefined || own === 'names') return 'keys';
  if (own === 'keys') return 'all';
  return undefined;
}

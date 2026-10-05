/**
 * The type warning shown while a relationship is dragged (042 R11, FR-018) and next to a column
 * pair in the drawer (052): nothing is stored.
 */
import { sameColumnType } from '@sododeck/model';
import type { DbColumn, Dialect } from '@sododeck/schema';

import { typeText } from '../table-layout';

type Column = Pick<DbColumn, 'type' | 'size' | 'enumRef'>;

/**
 * "int → uuid" when the two columns' types differ, else undefined. Equivalence is the lint's
 * (`sameColumnType`, 047): `int` and `integer` match, `timestamptz` and `timestamp` do not on
 * Postgres, sizes compare without spaces, an enum column matches only the same enum.
 */
export function typeMismatch(
  source: Column,
  target: Column,
  dialect: Dialect = 'generic',
): string | undefined {
  return sameColumnType(source, target, dialect)
    ? undefined
    : `${typeText(source)} → ${typeText(target)}`;
}

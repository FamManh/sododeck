/**
 * The type warning shown while a relationship is dragged (042 R11, FR-018): nothing is stored,
 * dialect-aware equivalence is 047's lint.
 */
import type { DbColumn } from '@sododeck/schema';

import { typeText } from '../table-layout';

type Column = Pick<DbColumn, 'type' | 'size' | 'enumRef'>;

/**
 * "int → uuid" when the two columns' types differ (name case-insensitive, then size; an enum
 * column matches only the same enum), else undefined.
 */
export function typeMismatch(source: Column, target: Column): string | undefined {
  const text = `${typeText(source)} → ${typeText(target)}`;
  if (source.enumRef !== undefined || target.enumRef !== undefined) {
    return source.enumRef === target.enumRef ? undefined : text;
  }
  const same =
    source.type.trim().toLowerCase() === target.type.trim().toLowerCase() &&
    source.size === target.size;
  return same ? undefined : text;
}

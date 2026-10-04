/**
 * Dialect → dialect type conversion on import (044 research R10, FR-008): 045's common type list
 * read in the other direction. A type is matched by its spelling in the source dialect or any
 * name of the common type (canonical or alias), then written in the target dialect with its size
 * where that dialect keeps one. Types outside the list are kept as written. Pure; 045's
 * `translateType` (Generic → dialect) is unchanged.
 */
import { commonTypeOf } from '@sododeck/model';

import type { SqlDialect } from './types';

export interface ConvertedType {
  type: string;
  size?: string;
  /** `false` when the type is not in the common list (kept as written). */
  mapped: boolean;
}

/** `type` (without size) and `size` written in `from`, converted to `to`. */
export function convertType(
  type: string,
  size: string | undefined,
  from: SqlDialect,
  to: SqlDialect,
): ConvertedType {
  const entry = commonTypeOf(type, from);
  if (entry === undefined) return { type, ...(size === undefined ? {} : { size }), mapped: false };
  const target = entry[to];
  const fixed = /^(.*)\((.*)\)$/.exec(target);
  if (fixed !== null) return { type: fixed[1] ?? target, size: fixed[2] ?? '', mapped: true };
  const kept = entry.keepsSize.includes(to) ? size : undefined;
  return { type: target, ...(kept === undefined ? {} : { size: kept }), mapped: true };
}

/** `type(size)` or `type`. */
export const writtenType = (type: string, size?: string): string =>
  size === undefined || size === '' ? type : `${type}(${size})`;

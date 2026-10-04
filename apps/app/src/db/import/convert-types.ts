/**
 * Dialect → dialect type conversion on import (044 research R10, FR-008): 045's common type list
 * read in the other direction. A type is matched by its spelling in the source dialect or any
 * name of the common type (canonical or alias), then written in the target dialect with its size
 * where that dialect keeps one. Types outside the list are kept as written. Pure; 045's
 * `translateType` (Generic → dialect) is unchanged.
 */
import { COMMON_TYPES, type CommonType } from '../export/common-types';
import type { SqlDialect } from './types';

export interface ConvertedType {
  type: string;
  size?: string;
  /** `false` when the type is not in the common list (kept as written). */
  mapped: boolean;
}

const normalise = (type: string) => type.trim().toLowerCase().replace(/\s+/g, ' ');

/** `char(36)` → `char`; `jsonb` → `jsonb`. */
const baseOf = (spelling: string) => normalise(spelling.replace(/\(.*\)$/, ''));

/** Common type of `type` as written in `from`: its spelling there first, then any of its names. */
function commonOf(type: string, from: SqlDialect): CommonType | undefined {
  const base = normalise(type);
  return (
    COMMON_TYPES.find((entry) => baseOf(entry[from]) === base && !/\(/.test(entry[from])) ??
    COMMON_TYPES.find((entry) => entry.canonical === base || entry.aliases.includes(base))
  );
}

/** `type` (without size) and `size` written in `from`, converted to `to`. */
export function convertType(
  type: string,
  size: string | undefined,
  from: SqlDialect,
  to: SqlDialect,
): ConvertedType {
  const entry = commonOf(type, from);
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

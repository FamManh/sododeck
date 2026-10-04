/**
 * The Generic deck's common type list (045, research R3, data-model §4): a type typed on a
 * Generic deck is written as its equivalent in the dialect picked at SQL export. Types not in the
 * list are written as stored and noted by the caller. Pure data and one lookup.
 */
import { COMMON_TYPES, type CommonType } from '@sododeck/model';

import type { SqlDialect } from './types';

const BY_NAME = new Map<string, CommonType>(
  COMMON_TYPES.flatMap((entry) => [entry.canonical, ...entry.aliases].map((name) => [name, entry])),
);

/** Lower case, trimmed, inner whitespace collapsed. */
function normalise(type: string): string {
  return type.trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface TranslatedType {
  /** The type without its size, e.g. `varchar`, `char` (for MySQL `uuid`). */
  type: string;
  size?: string;
  /** `type(size)` or `type`. */
  written: string;
  /** `false` when the stored type is not in the list (written as stored). */
  mapped: boolean;
  /** MySQL `varchar` had no length and was given 255. */
  sizeDefaulted: boolean;
}

function withSize(type: string, size: string | undefined): string {
  return size === undefined || size === '' ? type : `${type}(${size})`;
}

/**
 * The dialect form of a Generic type. A size typed inside the type (`varchar(80)`) counts like
 * the `size` field. The size is kept only where the type's `keepsSize` allows.
 */
export function translateType(
  stored: string,
  size: string | undefined,
  dialect: SqlDialect,
): TranslatedType {
  const inline = /^(.*?)\s*\(([^()]*)\)$/.exec(stored.trim());
  const base = normalise(inline?.[1] ?? stored);
  const typedSize = (size ?? inline?.[2])?.replace(/\s+/g, '') || undefined;
  const entry = BY_NAME.get(base);
  if (entry === undefined) {
    const written = withSize(stored.trim(), size);
    return {
      type: stored.trim(),
      ...(size === undefined ? {} : { size }),
      written,
      mapped: false,
      sizeDefaulted: false,
    };
  }
  const target = entry[dialect];
  const fixed = /^(.*)\((.*)\)$/.exec(target);
  if (fixed !== null) {
    const [, type = target, fixedSize = ''] = fixed;
    return { type, size: fixedSize, written: target, mapped: true, sizeDefaulted: false };
  }
  let kept = entry.keepsSize.includes(dialect) ? typedSize : undefined;
  let sizeDefaulted = false;
  if (dialect === 'mysql' && entry.canonical === 'varchar' && kept === undefined) {
    kept = '255';
    sizeDefaulted = true;
  }
  return {
    type: target,
    ...(kept === undefined ? {} : { size: kept }),
    written: withSize(target, kept),
    mapped: true,
    sizeDefaulted,
  };
}

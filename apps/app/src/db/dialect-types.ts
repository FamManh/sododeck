/**
 * Type catalog per dialect for the details drawer's type picker (052, research R5). The SQL lists
 * start from 045's `COMMON_TYPES` spellings so the picker cannot drift from export and import,
 * plus a few dialect-only types. App data, not part of a deck; types outside a list are still
 * allowed and only marked in the drawer.
 */
import type { Dialect } from '@sododeck/schema';

import { COMMON_TYPES, type CommonType } from './export/common-types';
import type { SqlDialect } from './export/types';

export type TypeKind =
  'number' | 'text' | 'datetime' | 'boolean' | 'binary' | 'json' | 'id' | 'other';
export type SizeKind = 'none' | 'length' | 'precision';

export interface TypeEntry {
  /** As written in that dialect, lower case. */
  name: string;
  /** Picker group. */
  kind: TypeKind;
  /** Which size fields the drawer shows. */
  size: SizeKind;
}

const KIND_BY_CANONICAL: Readonly<Record<string, TypeKind>> = {
  int: 'number',
  smallint: 'number',
  bigint: 'number',
  decimal: 'number',
  real: 'number',
  double: 'number',
  char: 'text',
  varchar: 'text',
  text: 'text',
  boolean: 'boolean',
  uuid: 'id',
  date: 'datetime',
  time: 'datetime',
  timestamp: 'datetime',
  datetime: 'datetime',
  json: 'json',
  blob: 'binary',
};

const LENGTH_TYPES = new Set(['char', 'varchar', 'binary', 'varbinary', 'bit']);
const PRECISION_TYPES = new Set(['decimal', 'numeric']);

function sizeOf(name: string): SizeKind {
  if (LENGTH_TYPES.has(name)) return 'length';
  if (PRECISION_TYPES.has(name)) return 'precision';
  return 'none';
}

const entry = (name: string, kind: TypeKind): TypeEntry => ({ name, kind, size: sizeOf(name) });

/** `char(36)` → `char`. */
const baseOf = (spelling: string) => spelling.replace(/\(.*\)$/, '');

function fromCommon(dialect: SqlDialect): TypeEntry[] {
  const seen = new Set<string>();
  const list: TypeEntry[] = [];
  for (const common of COMMON_TYPES) {
    const name = baseOf(common[dialect]);
    if (seen.has(name)) continue;
    seen.add(name);
    // The spelling's own kind: MySQL `uuid` is written `char`, which is text.
    const kind = KIND_BY_CANONICAL[name] ?? KIND_BY_CANONICAL[common.canonical] ?? 'other';
    list.push(entry(name, kind));
  }
  return list;
}

function extend(base: TypeEntry[], extras: readonly TypeEntry[]): TypeEntry[] {
  const names = new Set(base.map((t) => t.name));
  return [...base, ...extras.filter((t) => !names.has(t.name))];
}

const POSTGRES_EXTRAS = [
  entry('serial', 'number'),
  entry('bigserial', 'number'),
  entry('smallserial', 'number'),
  entry('money', 'number'),
  entry('interval', 'datetime'),
  entry('inet', 'other'),
  entry('cidr', 'other'),
  entry('macaddr', 'other'),
  entry('tsvector', 'other'),
  entry('xml', 'other'),
  entry('json', 'json'),
];

const MYSQL_EXTRAS = [
  entry('tinyint', 'number'),
  entry('mediumint', 'number'),
  entry('year', 'datetime'),
  entry('tinytext', 'text'),
  entry('mediumtext', 'text'),
  entry('longtext', 'text'),
  entry('binary', 'binary'),
  entry('varbinary', 'binary'),
  entry('longblob', 'binary'),
];

export const DIALECT_TYPES: Readonly<Record<Dialect, readonly TypeEntry[]>> = {
  generic: COMMON_TYPES.map((t) => entry(t.canonical, KIND_BY_CANONICAL[t.canonical] ?? 'other')),
  postgres: extend(fromCommon('postgres'), POSTGRES_EXTRAS),
  mysql: extend(fromCommon('mysql'), MYSQL_EXTRAS),
  sqlite: fromCommon('sqlite'),
};

export const INDEX_METHODS: Readonly<Record<Dialect, readonly string[]>> = {
  generic: ['btree', 'hash'],
  postgres: ['btree', 'hash', 'gist', 'gin', 'spgist', 'brin'],
  mysql: ['btree', 'hash'],
  sqlite: [],
};

export const DIALECT_HINTS: Readonly<Record<Dialect, string>> = {
  generic: 'Common types only; SQL export asks which dialect',
  postgres: 'uuid, jsonb, timestamptz, enums, arrays',
  mysql: 'char(36) ids, json, datetime, ENUM per column',
  sqlite: 'Type affinity: integer, text, real, blob',
};

const normalise = (type: string) => type.trim().toLowerCase().replace(/\s+/g, ' ');

function commonByName(name: string): CommonType | undefined {
  return COMMON_TYPES.find((c) => c.canonical === name || c.aliases.includes(name));
}

/** Case-insensitive, whitespace-normalised; aliases of the common types count. */
export function typeEntry(dialect: Dialect, typeText: string): TypeEntry | undefined {
  const name = normalise(baseOf(typeText));
  const list = DIALECT_TYPES[dialect];
  const direct = list.find((t) => t.name === name);
  if (direct !== undefined) return direct;
  const common = commonByName(name);
  if (common === undefined) return undefined;
  const spelled = dialect === 'generic' ? common.canonical : baseOf(common[dialect]);
  return list.find((t) => t.name === spelled);
}

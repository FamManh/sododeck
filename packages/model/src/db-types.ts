/**
 * Database type data (045 common list, 052 per-dialect catalog, 047 lint). Pure constants and
 * lookups with no imports beyond the schema types, so the problems worker and the app share one
 * source: `checkDeck` needs it for type equivalence and "type not in the list" (047 research R2).
 */
import type { Dialect } from '@sododeck/schema';

/** The dialects a Generic deck can be exported to. */
type SqlDialect = Exclude<Dialect, 'generic'>;

export interface CommonType {
  canonical: string;
  aliases: readonly string[];
  postgres: string;
  mysql: string;
  sqlite: string;
  /** Dialects that keep the stored size (length, or precision and scale). */
  keepsSize: readonly SqlDialect[];
}

export const COMMON_TYPES: readonly CommonType[] = [
  {
    canonical: 'int',
    aliases: ['integer', 'int4', 'mediumint'],
    postgres: 'integer',
    mysql: 'int',
    sqlite: 'integer',
    keepsSize: [],
  },
  {
    canonical: 'smallint',
    aliases: ['int2', 'tinyint'],
    postgres: 'smallint',
    mysql: 'smallint',
    sqlite: 'integer',
    keepsSize: [],
  },
  {
    canonical: 'bigint',
    aliases: ['int8'],
    postgres: 'bigint',
    mysql: 'bigint',
    sqlite: 'integer',
    keepsSize: [],
  },
  {
    canonical: 'decimal',
    aliases: ['numeric', 'dec'],
    postgres: 'numeric',
    mysql: 'decimal',
    sqlite: 'numeric',
    keepsSize: ['postgres', 'mysql'],
  },
  {
    canonical: 'real',
    aliases: ['float', 'float4'],
    postgres: 'real',
    mysql: 'float',
    sqlite: 'real',
    keepsSize: [],
  },
  {
    canonical: 'double',
    aliases: ['double precision', 'float8'],
    postgres: 'double precision',
    mysql: 'double',
    sqlite: 'real',
    keepsSize: [],
  },
  {
    canonical: 'char',
    aliases: ['character'],
    postgres: 'char',
    mysql: 'char',
    sqlite: 'text',
    keepsSize: ['postgres', 'mysql'],
  },
  {
    canonical: 'varchar',
    aliases: ['character varying', 'string'],
    postgres: 'varchar',
    mysql: 'varchar',
    sqlite: 'text',
    keepsSize: ['postgres', 'mysql'],
  },
  {
    canonical: 'text',
    aliases: ['clob', 'longtext', 'mediumtext'],
    postgres: 'text',
    mysql: 'text',
    sqlite: 'text',
    keepsSize: [],
  },
  {
    canonical: 'boolean',
    aliases: ['bool'],
    postgres: 'boolean',
    mysql: 'boolean',
    sqlite: 'integer',
    keepsSize: [],
  },
  {
    canonical: 'uuid',
    aliases: ['guid'],
    postgres: 'uuid',
    mysql: 'char(36)',
    sqlite: 'text',
    keepsSize: [],
  },
  {
    canonical: 'date',
    aliases: [],
    postgres: 'date',
    mysql: 'date',
    sqlite: 'text',
    keepsSize: [],
  },
  {
    canonical: 'time',
    aliases: [],
    postgres: 'time',
    mysql: 'time',
    sqlite: 'text',
    keepsSize: [],
  },
  {
    canonical: 'timestamp',
    aliases: ['timestamptz', 'timestamp with time zone'],
    postgres: 'timestamptz',
    mysql: 'timestamp',
    sqlite: 'text',
    keepsSize: [],
  },
  {
    canonical: 'datetime',
    aliases: ['timestamp without time zone'],
    postgres: 'timestamp',
    mysql: 'datetime',
    sqlite: 'text',
    keepsSize: [],
  },
  {
    canonical: 'json',
    aliases: ['jsonb'],
    postgres: 'jsonb',
    mysql: 'json',
    sqlite: 'text',
    keepsSize: [],
  },
  {
    canonical: 'blob',
    aliases: ['binary', 'varbinary', 'bytea', 'longblob'],
    postgres: 'bytea',
    mysql: 'blob',
    sqlite: 'blob',
    keepsSize: [],
  },
];

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

/**
 * Common type of `type` as written in `dialect`: its spelling there first (so Postgres
 * `timestamp` is the `datetime` entry and `timestamptz` the `timestamp` one), then any name of the
 * common type (canonical or alias). `generic` has no spelling of its own.
 */
export function commonTypeOf(type: string, dialect: Dialect): CommonType | undefined {
  const base = normalise(type);
  const spelled =
    dialect === 'generic'
      ? undefined
      : COMMON_TYPES.find(
          (entry) => normalise(baseOf(entry[dialect])) === base && !/\(/.test(entry[dialect]),
        );
  return spelled ?? commonByName(base);
}

interface ColumnType {
  type: string;
  size?: string | undefined;
  enumRef?: string | undefined;
}

/** `varchar(80)` → base and size; the `size` field wins when both are present. */
function splitType(column: ColumnType): { name: string; size: string } {
  const inline = /^(.*?)\s*\(([^()]*)\)$/.exec(column.type.trim());
  const name = normalise(inline?.[1] ?? column.type);
  const size = (column.size ?? inline?.[2] ?? '').replace(/\s+/g, '');
  return { name, size };
}

/**
 * Whether two columns hold the same type: equal names and sizes, or both resolve to the same
 * common type with equal sizes (`int` and `integer`). Enum columns match only the same enum.
 */
export function sameColumnType(a: ColumnType, b: ColumnType, dialect: Dialect): boolean {
  if (a.enumRef !== undefined || b.enumRef !== undefined) return a.enumRef === b.enumRef;
  const left = splitType(a);
  const right = splitType(b);
  if (left.size !== right.size) return false;
  if (left.name === right.name) return true;
  const common = commonTypeOf(left.name, dialect);
  return common !== undefined && common === commonTypeOf(right.name, dialect);
}

/** The type a generated `id` primary key gets in `dialect`. */
export function idTypeOf(dialect: Dialect): string {
  const uuid = COMMON_TYPES.find((entry) => entry.canonical === 'uuid');
  return uuid === undefined || dialect === 'generic' ? 'uuid' : uuid[dialect];
}

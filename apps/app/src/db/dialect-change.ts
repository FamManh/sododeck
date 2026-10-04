/**
 * Dialect change as a pure plan (052, research R6): which column types a new deck dialect
 * converts, which stay as written. SQL → SQL reuses 044's `convertType`, Generic → SQL 045's
 * `translateType`; SQL → Generic maps to the common type's canonical name. The write
 * (`applyDialectChange`) lives with the drawer because it needs the editor.
 */
import { isDbTable } from '@sododeck/model';
import type { DbColumn, Dialect, Id, Node, SododeckFile } from '@sododeck/schema';

import { COMMON_TYPES, translateType, type CommonType } from './export/common-types';
import { convertType, writtenType } from './import/convert-types';
import type { SqlDialect } from './export/types';

export interface ColumnChange {
  tableId: Id;
  columnId: Id;
  /** `orders.created_at`, schema-qualified when the deck has several schemas. */
  label: string;
  before: { type: string; size?: string };
  after: { type: string; size?: string; increment?: true };
  /** The stored size is gone in the target spelling. */
  sizeDropped: boolean;
}

export interface KeptColumn {
  tableId: Id;
  columnId: Id;
  label: string;
  type: string;
}

export interface DialectPlan {
  from: Dialect;
  to: Dialect;
  changes: ColumnChange[];
  kept: KeptColumn[];
}

const SERIAL: Readonly<Record<string, string>> = {
  serial: 'int',
  bigserial: 'bigint',
  smallserial: 'smallint',
};

const normalise = (type: string) => type.trim().toLowerCase().replace(/\s+/g, ' ');
const isSql = (dialect: Dialect): dialect is SqlDialect => dialect !== 'generic';

/** `varchar(80)` → base and inline size; the `size` field wins when both are present. */
function splitType(type: string, size: string | undefined): { base: string; size?: string } {
  const inline = /^(.*?)\s*\(([^()]*)\)$/.exec(type.trim());
  const base = inline?.[1] ?? type.trim();
  const effective = size?.replace(/\s+/g, '') || inline?.[2]?.replace(/\s+/g, '') || undefined;
  return { base, ...(effective === undefined ? {} : { size: effective }) };
}

/** The common type of a SQL-dialect spelling or any common name. */
function commonOf(base: string, from: SqlDialect): CommonType | undefined {
  const name = normalise(base);
  return (
    COMMON_TYPES.find((entry) => !/\(/.test(entry[from]) && normalise(entry[from]) === name) ??
    COMMON_TYPES.find((entry) => entry.canonical === name || entry.aliases.includes(name))
  );
}

interface Converted {
  type: string;
  size?: string;
  increment?: true;
  mapped: boolean;
}

function convert(column: DbColumn, from: Dialect, to: Dialect): Converted {
  const { base, size } = splitType(column.type, column.size);
  const name = normalise(base);
  if (from === 'postgres' && name in SERIAL && isSql(to)) {
    const target = translateType(SERIAL[name] ?? name, undefined, to);
    return { type: target.type, increment: true, mapped: true };
  }
  if (to === 'generic') {
    if (!isSql(from)) return { type: base, mapped: false };
    const common = commonOf(base, from);
    if (common === undefined)
      return { type: base, ...(size === undefined ? {} : { size }), mapped: false };
    const keeps = common.keepsSize.length > 0 && size !== undefined;
    return { type: common.canonical, ...(keeps ? { size } : {}), mapped: true };
  }
  if (from === 'generic') {
    const out = translateType(base, size, to);
    return {
      type: out.type,
      ...(out.size === undefined ? {} : { size: out.size }),
      mapped: out.mapped,
    };
  }
  const out = convertType(base, size, from, to);
  return {
    type: out.type,
    ...(out.size === undefined ? {} : { size: out.size }),
    mapped: out.mapped,
  };
}

function tables(deck: SododeckFile): Node[] {
  return deck.nodes.filter(isDbTable);
}

export function planDialectChange(deck: SododeckFile, to: Dialect): DialectPlan {
  const from: Dialect = deck.dialect ?? 'generic';
  const plan: DialectPlan = { from, to, changes: [], kept: [] };
  if (from === to) return plan;

  const all = tables(deck);
  const qualify = new Set(all.map((t) => t.schema ?? '')).size > 1;
  for (const node of all) {
    const tableLabel =
      qualify && node.schema !== undefined ? `${node.schema}.${node.title}` : node.title;
    for (const column of node.columns ?? []) {
      if (column.enumRef !== undefined || column.type.trim() === '') continue;
      const label = `${tableLabel}.${column.name}`;
      const out = convert(column, from, to);
      if (!out.mapped) {
        plan.kept.push({ tableId: node.id, columnId: column.id, label, type: column.type });
        continue;
      }
      const before = splitType(column.type, column.size);
      const noop =
        normalise(out.type) === normalise(column.type) &&
        out.size === column.size &&
        out.increment === undefined;
      if (noop) continue;
      plan.changes.push({
        tableId: node.id,
        columnId: column.id,
        label,
        before: {
          type: column.type,
          ...(column.size === undefined ? {} : { size: column.size }),
        },
        after: {
          type: out.type,
          ...(out.size === undefined ? {} : { size: out.size }),
          ...(out.increment === undefined ? {} : { increment: true as const }),
        },
        sizeDropped: before.size !== undefined && out.size === undefined,
      });
    }
  }
  return plan;
}

/** Groups for the dialog's "+ n more" line: `uuid → char(36)` with a count. */
export function changeGroups(
  plan: DialectPlan,
): { before: string; after: string; count: number }[] {
  const groups = new Map<string, { before: string; after: string; count: number }>();
  for (const change of plan.changes) {
    const before = writtenType(change.before.type, change.before.size);
    const after = writtenType(change.after.type, change.after.size);
    const key = `${before}\u0000${after}`;
    const group = groups.get(key);
    if (group === undefined) groups.set(key, { before, after, count: 1 });
    else group.count += 1;
  }
  return [...groups.values()];
}

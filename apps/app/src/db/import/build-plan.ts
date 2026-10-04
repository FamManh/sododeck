/**
 * `RawSchema` → `ImportPlan` (044 T011, FR-010…FR-016, research R6–R10): names resolved, plan ids
 * from an injectable allocator (never from names, constitution III), tables as `db-table` nodes,
 * references as relationship edges with column ends, groups per DBML table group or per schema,
 * the dialect outcome and type conversions, and a report entry for everything not mapped as is.
 * Deterministic for the same input. Pure.
 */
import type { Fragment } from '@sododeck/model';
import {
  emptySododeckFile,
  type Cardinality,
  type DbCheck,
  type DbColumn,
  type DbIndex,
  type DbIndexPart,
  type Dialect,
  type Edge,
  type Group,
  type Id,
  type Node,
} from '@sododeck/schema';

import { convertType } from './convert-types';
import { copyName, nameKey } from './names';
import { plural } from './report-text';
import type {
  ChangedEntry,
  DialectOutcome,
  ImportFormat,
  ImportPlan,
  ImportReport,
  ImportSource,
  ImportTarget,
  PlanEnum,
  PlanSticky,
  RawColumn,
  RawRef,
  RawSchema,
  RawTable,
  RawTableRef,
  SkippedEntry,
  SqlDialect,
  TypeConversion,
} from './types';

export type IdPrefix = 'node' | 'dbcol' | 'dbidx' | 'dbchk' | 'edge' | 'group' | 'enum' | 'enumval';

/** Plan-local ids: opaque, unique within the plan; paste allocates the real ones. */
export type Allocator = (prefix: IdPrefix) => Id;

export function createAllocator(): Allocator {
  const counts = new Map<IdPrefix, number>();
  return (prefix) => {
    const next = (counts.get(prefix) ?? 0) + 1;
    counts.set(prefix, next);
    return `${prefix}.${String(next)}`;
  };
}

export interface PlanContext {
  /** The dialect the import claims (picked, detected or DBML `database_type`); null = none. */
  importDialect: SqlDialect | null;
  allocate?: Allocator;
}

/** FR-007…FR-009. */
export function dialectOutcome(
  importDialect: SqlDialect | null,
  target: ImportTarget,
): { outcome: DialectOutcome; setDialect: Dialect | null } {
  if (importDialect === null) return { outcome: 'same', setDialect: null };
  if (target.kind === 'new-deck') return { outcome: 'set', setDialect: importDialect };
  if (target.deckDialect === 'generic') {
    return target.deckHasTables
      ? { outcome: 'keep-generic', setDialect: null }
      : { outcome: 'set', setDialect: importDialect };
  }
  return target.deckDialect === importDialect
    ? { outcome: 'same', setDialect: null }
    : { outcome: 'convert', setDialect: null };
}

const SERIAL: Record<string, string> = {
  serial: 'integer',
  bigserial: 'bigint',
  smallserial: 'smallint',
};

/** `varchar(255)` → `varchar` + `255`; `timestamp(3) with time zone` → `timestamp with time zone` + `3`. */
export function splitType(written: string): { type: string; size?: string } {
  const type = written.trim().toLowerCase().replace(/\s+/g, ' ');
  if (/^(enum|set)\s*\(/.test(type)) return { type };
  const match = /^(.*?)\s*\(([^()]*)\)(.*)$/.exec(type);
  if (match === null) return { type };
  const base = `${match[1] ?? ''}${match[3] ?? ''}`.replace(/\s+/g, ' ').trim();
  const size = (match[2] ?? '').replace(/\s+/g, '');
  return size === '' ? { type: base } : { type: base, size };
}

/** `#3498DB` → `#3498db`; `#abc` → `#aabbcc`; anything else → undefined (deck colours are lower hex). */
export function hexColour(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
  if (short !== null)
    return `#${short
      .slice(1)
      .map((c) => `${c}${c}`)
      .join('')}`.toLowerCase();
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : undefined;
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const displayName = (t: RawTableRef) => (t.schema === undefined ? t.name : `${t.schema}.${t.name}`);

interface PlannedTable {
  raw: RawTable;
  node: Node;
  /** Column id by lower-case name. */
  columnIds: Map<string, Id>;
  columns: Map<Id, DbColumn>;
}

/** Type families that may link (FR-024, also used for suggestions). */
export function typeFamily(type: string): 'integer' | 'text' | 'uuid' | 'other' {
  const t = type.toLowerCase();
  if (/^(tiny|small|medium|big)?int(eger)?\b|^(big|small)?serial\b|^int[248]\b|^number\b/.test(t))
    return 'integer';
  if (/^(var)?char|^character|^text\b|^string\b|^n?varchar|^citext\b/.test(t)) return 'text';
  if (/^uuid\b|^guid\b/.test(t)) return 'uuid';
  return 'other';
}

export function buildPlan(
  raw: RawSchema,
  source: Pick<ImportSource, 'fileName'>,
  target: ImportTarget,
  context: PlanContext,
): ImportPlan {
  const allocate = context.allocate ?? createAllocator();
  const skipped: SkippedEntry[] = [...raw.skipped];
  const changed: ChangedEntry[] = [...raw.changed];
  const { outcome, setDialect } = dialectOutcome(context.importDialect, target);
  const convertTo =
    outcome === 'convert' && context.importDialect !== null && target.deckDialect !== 'generic'
      ? { from: context.importDialect, to: target.deckDialect }
      : null;

  // --- enums ------------------------------------------------------------------------------------
  const enums: PlanEnum[] = [];
  const enumByKey = new Map<string, PlanEnum>();
  const deckEnums = new Set(target.enumNames.map((e) => nameKey(e.name, e.schema)));
  const addEnum = (
    name: string,
    schema: string | undefined,
    values: { name: string; note?: string }[],
    note: string | undefined,
    line: number,
  ): PlanEnum => {
    const kept = values.filter((v) => v.name !== '');
    if (kept.length < values.length) {
      changed.push({
        line,
        target: name,
        kind: 'option-dropped',
        detail: 'an empty enum value is not stored',
      });
    }
    const planEnum: PlanEnum = {
      planId: allocate('enum'),
      name,
      ...(schema === undefined ? {} : { schema }),
      ...(note === undefined || note === '' ? {} : { note }),
      values: kept.map((v) => ({
        name: v.name,
        ...(v.note === undefined || v.note === '' ? {} : { note: v.note }),
      })),
    };
    enums.push(planEnum);
    const k = nameKey(name, schema);
    if (!enumByKey.has(k)) enumByKey.set(k, planEnum);
    if (deckEnums.has(k)) {
      changed.push({
        line,
        target: name,
        kind: 'enum-name-exists',
        detail: `an enum named ${name} already exists; added as a new enum`,
      });
    }
    return planEnum;
  };
  for (const e of raw.enums) addEnum(e.name, e.schema, e.values, e.note, e.line);

  const findEnum = (
    type: string,
    typeSchema: string | undefined,
    tableSchema: string | undefined,
  ): PlanEnum | undefined => {
    let name = type;
    let schema = typeSchema;
    const qualified = /^("?)([^".]+)\1\.("?)([^"]+)\3$/.exec(type);
    if (schema === undefined && qualified !== null) {
      schema = qualified[2];
      name = qualified[4] ?? type;
    }
    return (
      enumByKey.get(nameKey(name, schema)) ??
      (schema === undefined
        ? (enumByKey.get(nameKey(name, tableSchema)) ?? enumByKey.get(nameKey(name, 'public')))
        : undefined) ??
      [...enumByKey.values()].find(
        (e) => sameName(e.name, name) && (schema === undefined || e.schema === undefined),
      )
    );
  };

  // MySQL inline ENUM(…): one deck enum per distinct value list, named after its first column.
  const inlineByValues = new Map<string, PlanEnum>();
  const inlineEnum = (table: RawTable, column: RawColumn): PlanEnum | undefined => {
    if (column.enumValues === undefined) return undefined;
    const listKey = JSON.stringify(column.enumValues);
    const known = inlineByValues.get(listKey);
    if (known !== undefined) return known;
    const created = addEnum(
      `${table.name}_${column.name}`,
      table.schema,
      column.enumValues.map((name) => ({ name })),
      undefined,
      column.line,
    );
    inlineByValues.set(listKey, created);
    return created;
  };

  // --- tables -----------------------------------------------------------------------------------
  const taken = new Set(target.tableNames.map((t) => nameKey(t.name, t.schema)));
  const seenInImport = new Set<string>();
  const planned: PlannedTable[] = [];
  const conversions = new Map<string, TypeConversion>();
  const keptTypes = new Map<string, number>();

  for (const table of raw.tables) {
    let title = table.name;
    const original = nameKey(table.name, table.schema);
    const isTaken = (candidate: string) => taken.has(nameKey(candidate, table.schema));
    if (seenInImport.has(original)) {
      title = copyName(table.name, isTaken);
      changed.push({
        line: table.line,
        target: displayName(table),
        kind: 'renamed-duplicate',
        detail: `${displayName(table)} appears twice in this import; the second is imported as ${title}`,
      });
    } else if (taken.has(original)) {
      title = copyName(table.name, isTaken);
      changed.push({
        line: table.line,
        target: displayName(table),
        kind: 'name-exists',
        detail: `a table named ${table.name} already exists, imported as ${title}`,
      });
    }
    seenInImport.add(original);
    taken.add(nameKey(title, table.schema));

    const pkNames = new Set<string>();
    for (const name of table.primaryKey ?? []) pkNames.add(name.toLowerCase());
    for (const index of table.indexes) {
      if (index.pk !== true) continue;
      for (const part of index.parts) if ('column' in part) pkNames.add(part.column.toLowerCase());
    }
    const declaredOrder = [
      ...(table.primaryKey ?? []),
      ...table.indexes
        .filter((i) => i.pk === true)
        .flatMap((i) => i.parts.flatMap((p) => ('column' in p ? [p.column] : []))),
    ].map((n) => n.toLowerCase());
    const columnOrder = table.columns
      .map((c) => c.name.toLowerCase())
      .filter((n) => pkNames.has(n));
    if (declaredOrder.length > 1 && declaredOrder.join('\u0000') !== columnOrder.join('\u0000')) {
      changed.push({
        line: table.line,
        target: displayName(table),
        kind: 'option-dropped',
        detail: 'the primary key follows the column order',
      });
    }

    const columnIds = new Map<string, Id>();
    const columns = new Map<Id, DbColumn>();
    const columnList: DbColumn[] = [];
    for (const column of table.columns) {
      if (columnIds.has(column.name.toLowerCase())) {
        changed.push({
          line: column.line,
          target: `${table.name}.${column.name}`,
          kind: 'option-dropped',
          detail: 'a repeated column name is not imported',
        });
        continue;
      }
      const id = allocate('dbcol');
      const label = `${title}.${column.name}`;
      let { type, size } = splitType(column.type);
      let increment = column.increment === true;
      const serial = SERIAL[type];
      if (serial !== undefined) {
        type = serial;
        increment = true;
      }
      let enumRef: Id | undefined;
      const inline = inlineEnum(table, column);
      const named =
        inline ??
        (column.type === '' ? undefined : findEnum(column.type, column.typeSchema, table.schema));
      if (named !== undefined) {
        enumRef = named.planId;
        type = named.name;
        size = undefined;
      } else if (type === '') {
        type = 'text';
        changed.push({
          line: column.line,
          target: label,
          kind: 'option-dropped',
          detail: `${label} has no type; stored as text`,
        });
      } else if (convertTo !== null) {
        const converted = convertType(type, size, convertTo.from, convertTo.to);
        const from = type;
        if (converted.mapped) {
          type = converted.type;
          size = converted.size;
          const k = `${from}\u0000${type}`;
          const entry = conversions.get(k) ?? { from, to: type, count: 0 };
          entry.count++;
          conversions.set(k, entry);
        } else keptTypes.set(type, (keptTypes.get(type) ?? 0) + 1);
      }
      const dbColumn: DbColumn = {
        id,
        name: column.name,
        type,
        ...(size === undefined ? {} : { size }),
        ...(column.pk === true || pkNames.has(column.name.toLowerCase()) ? { pk: true } : {}),
        ...(column.notNull === true ? { notNull: true } : {}),
        ...(column.unique === true ? { unique: true } : {}),
        ...(increment ? { increment: true } : {}),
        ...(column.default === undefined
          ? {}
          : column.default.kind === 'value'
            ? { default: column.default.value }
            : column.default.expr === ''
              ? {}
              : { defaultExpr: column.default.expr }),
        ...(column.check === undefined || column.check === '' ? {} : { check: column.check }),
        ...(enumRef === undefined ? {} : { enumRef }),
        ...(column.note === undefined || column.note === '' ? {} : { note: column.note }),
      };
      columnIds.set(column.name.toLowerCase(), id);
      columns.set(id, dbColumn);
      columnList.push(dbColumn);
    }

    const indexes: DbIndex[] = [];
    for (const index of table.indexes) {
      if (index.pk === true) continue;
      const parts: DbIndexPart[] = [];
      for (const part of index.parts) {
        if ('expr' in part) {
          if (part.expr !== '') parts.push({ expr: part.expr });
          continue;
        }
        const id = columnIds.get(part.column.toLowerCase());
        if (id === undefined) {
          changed.push({
            line: index.line,
            target: index.name ?? title,
            kind: 'option-dropped',
            detail: `index part ${part.column} names no column of ${title}; left out`,
          });
        } else parts.push(id);
      }
      if (parts.length === 0) continue;
      indexes.push({
        id: allocate('dbidx'),
        ...(index.name === undefined || index.name === '' ? {} : { name: index.name }),
        columns: parts,
        ...(index.unique === true ? { unique: true } : {}),
        ...(index.method === undefined || index.method === '' ? {} : { method: index.method }),
        ...(index.note === undefined || index.note === '' ? {} : { note: index.note }),
      });
    }
    const checks: DbCheck[] = table.checks
      .filter((c) => c.expr !== '')
      .map((c) => ({
        id: allocate('dbchk'),
        ...(c.name === undefined || c.name === '' ? {} : { name: c.name }),
        expr: c.expr,
      }));

    const fill = hexColour(table.headerColor);
    if (table.headerColor !== undefined && fill === undefined) {
      changed.push({
        line: table.line,
        target: title,
        kind: 'option-dropped',
        detail: `header colour ${table.headerColor} is not a hex colour`,
      });
    }
    const node: Node = {
      id: allocate('node'),
      type: 'db-table',
      title,
      ...(table.schema === undefined ? {} : { schema: table.schema }),
      ...(table.note === undefined || table.note === '' ? {} : { description: table.note }),
      ...(fill === undefined ? {} : { style: { fill } }),
      columns: columnList,
      ...(indexes.length === 0 ? {} : { indexes }),
      ...(checks.length === 0 ? {} : { checks }),
    };
    planned.push({ raw: table, node, columnIds, columns });
  }

  for (const entry of conversions.values()) {
    changed.push({
      target: entry.from,
      kind: 'type-converted',
      detail: `${entry.from} → ${entry.to} (${plural(entry.count, 'column')})`,
    });
  }
  for (const [type, count] of keptTypes) {
    changed.push({
      target: type,
      kind: 'type-kept',
      detail: `${type} kept as written (${plural(count, 'column')})`,
    });
  }

  // --- relationships ----------------------------------------------------------------------------
  // References resolve to the first table of a name (a repeated one is the anomaly).
  const findPlanned = (ref: RawTableRef): PlannedTable | undefined =>
    planned.find((p) => nameKey(p.raw.name, p.raw.schema) === nameKey(ref.name, ref.schema)) ??
    planned.find(
      (p) =>
        sameName(p.raw.name, ref.name) &&
        (ref.schema === undefined ||
          p.raw.schema === undefined ||
          sameName(ref.schema, 'public') ||
          sameName(p.raw.schema, 'public')),
    );

  const isUnique = (table: PlannedTable, ids: readonly Id[]): boolean => {
    const key = [...ids].sort().join('\u0000');
    const [only] = ids;
    if (ids.length === 1 && only !== undefined) {
      const column = table.columns.get(only);
      const pk = [...table.columns.values()].filter((c) => c.pk === true);
      if (column?.unique === true) return true;
      if (column?.pk === true && pk.length === 1) return true;
    }
    const pkKey = [...table.columns.values()]
      .filter((c) => c.pk === true)
      .map((c) => c.id)
      .sort()
      .join('\u0000');
    if (pkKey === key) return true;
    return (table.node.indexes ?? []).some(
      (i) =>
        i.unique === true &&
        i.columns.every((p) => typeof p === 'string') &&
        [...i.columns].sort().join('\u0000') === key,
    );
  };

  const edges: Edge[] = [];
  const danglingRef = (ref: RawRef, detail: string) => {
    skipped.push({ line: ref.line, excerpt: ref.excerpt, reason: 'dangling-fk', detail });
  };
  for (const ref of raw.refs) {
    const from = findPlanned(ref.from);
    const to = findPlanned(ref.to);
    if (from === undefined || to === undefined) {
      const missing = from === undefined ? ref.from : ref.to;
      danglingRef(ref, `references ${displayName(missing)}, not in this import`);
      continue;
    }
    const fromColumns = ref.from.columns.map((c) => from.columnIds.get(c.toLowerCase()));
    // A reference without columns means the referenced table's primary key.
    const toNames =
      ref.to.columns.length > 0
        ? ref.to.columns
        : [...to.columns.values()].filter((c) => c.pk === true).map((c) => c.name);
    const toColumns = toNames.map((c) => to.columnIds.get(c.toLowerCase()));
    const missingFrom = ref.from.columns.find((c) => !from.columnIds.has(c.toLowerCase()));
    const missingTo = toNames.find((c) => !to.columnIds.has(c.toLowerCase()));
    if (missingFrom !== undefined || missingTo !== undefined || toNames.length === 0) {
      const what =
        missingFrom !== undefined
          ? `${from.node.title}.${missingFrom}`
          : missingTo !== undefined
            ? `${to.node.title}.${missingTo}`
            : `a key of ${to.node.title}`;
      danglingRef(ref, `names ${what}, which is not in this import`);
      continue;
    }
    if (fromColumns.length !== toColumns.length) {
      danglingRef(ref, `has ${String(fromColumns.length)} and ${String(toColumns.length)} columns`);
      continue;
    }
    const fromIds = fromColumns.filter((id) => id !== undefined);
    const toIds = toColumns.filter((id) => id !== undefined);
    let cardinality: Cardinality;
    let fromOptional: boolean;
    let toOptional = false;
    if (ref.cardinality !== undefined) {
      cardinality = ref.cardinality;
      fromOptional = ref.fromOptional === true;
      toOptional = ref.toOptional === true;
    } else {
      cardinality = isUnique(from, fromIds) ? '1-1' : 'n-1';
      fromOptional = fromIds.some((id) => {
        const column = from.columns.get(id);
        return column?.notNull !== true && column?.pk !== true;
      });
    }
    // n–n between the two primary keys is the deck's plain n–n: no column ends (042).
    const keyOf = (t: PlannedTable) =>
      [...t.columns.values()].filter((c) => c.pk === true).map((c) => c.id);
    const plainManyToMany =
      cardinality === 'n-n' &&
      fromIds.length === 1 &&
      keyOf(from).join() === fromIds.join() &&
      keyOf(to).join() === toIds.join();
    edges.push({
      id: allocate('edge'),
      from: from.node.id,
      to: to.node.id,
      ...(ref.name === undefined || ref.name === '' ? {} : { label: ref.name }),
      ...(plainManyToMany ? {} : { fromColumns: fromIds, toColumns: toIds }),
      cardinality,
      ...(fromOptional ? { fromOptional: true } : {}),
      ...(toOptional ? { toOptional: true } : {}),
      ...(ref.onDelete === undefined ? {} : { onDelete: ref.onDelete }),
      ...(ref.onUpdate === undefined ? {} : { onUpdate: ref.onUpdate }),
    });
  }

  // --- groups -----------------------------------------------------------------------------------
  const groups: Group[] = [];
  if (raw.groups.length > 0) {
    for (const rawGroup of raw.groups) {
      const fill = hexColour(rawGroup.color);
      const group: Group = {
        id: allocate('group'),
        title: rawGroup.name,
        ...(rawGroup.note === undefined || rawGroup.note === ''
          ? {}
          : { description: rawGroup.note }),
        ...(fill === undefined ? {} : { style: { fill } }),
      };
      let members = 0;
      for (const member of rawGroup.tables) {
        const table = findPlanned(member);
        if (table === undefined || table.node.group !== undefined) continue;
        table.node.group = group.id;
        members++;
      }
      if (members > 0) groups.push(group);
    }
  } else {
    const schemas = [
      ...new Set(planned.flatMap((p) => (p.node.schema === undefined ? [] : [p.node.schema]))),
    ];
    if (schemas.length >= 2) {
      for (const schema of schemas) {
        const group: Group = { id: allocate('group'), title: schema };
        for (const table of planned) if (table.node.schema === schema) table.node.group = group.id;
        groups.push(group);
      }
    }
  }

  // --- notes ------------------------------------------------------------------------------------
  const stickies: PlanSticky[] = raw.notes
    .filter((n) => n.text.trim() !== '')
    .map((n) => ({ text: n.text }));
  let description: string | undefined;
  if (raw.projectNote !== undefined && raw.projectNote.trim() !== '') {
    if (target.deckHasDescription || target.kind === 'card')
      stickies.push({ text: raw.projectNote });
    else description = raw.projectNote;
  }

  const nodes = planned.map((p) => p.node);
  const fragment: Fragment = {
    sododeckFragment: 1,
    deck: { ...emptySododeckFile(), name: 'Fragment', nodes, groups, edges },
  };
  const format: ImportFormat = raw.format;
  const report: ImportReport = {
    source: {
      ...(source.fileName === undefined ? {} : { fileName: source.fileName }),
      format,
      dialect: context.importDialect,
    },
    mapped: {
      tables: nodes.length,
      relationships: edges.length,
      enums: enums.length,
      indexes: nodes.reduce((n, t) => n + (t.indexes?.length ?? 0), 0),
      checks: nodes.reduce(
        (n, t) =>
          n +
          (t.checks?.length ?? 0) +
          (t.columns ?? []).filter((c) => c.check !== undefined).length,
        0,
      ),
      groups: groups.length,
      stickies: stickies.length,
    },
    skipped: skipped.sort((a, b) => a.line - b.line),
    // By line; entries without one (type conversions) keep their order at the end.
    changed: changed
      .map((entry, i) => ({ entry, i }))
      .sort((a, b) => (a.entry.line ?? Infinity) - (b.entry.line ?? Infinity) || a.i - b.i)
      .map(({ entry }) => entry),
    suggestions: null,
  };
  return {
    fragment,
    enums,
    stickies,
    ...(description === undefined ? {} : { description }),
    setDialect,
    dialectOutcome: outcome,
    conversions: [...conversions.values()],
    report,
    suggestions: [],
  };
}

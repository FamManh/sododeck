/**
 * Matching rules of the schema sync (046 research R5): which parsed object is which existing
 * object, so renames keep ids. Index-based and pure: each function takes small descriptors and
 * returns pairs of positions; every object matches at most once. One-to-one only, so a wrong
 * guess is rare and always undoable.
 */

export type MatchHow = 'exact' | 'case' | 'memory' | 'rename';

export interface Pair {
  existing: number;
  parsed: number;
  how: MatchHow;
}

export interface Matching {
  pairs: Pair[];
  /** Positions of parsed objects with no existing counterpart. */
  added: number[];
  /** Positions of existing objects with no parsed counterpart. */
  removed: number[];
}

const lower = (text: string) => text.toLowerCase();

/** Pairs equal keys, exact spelling first, then ignoring case. Each side is used once. */
function pairByKey<E, P>(
  existing: readonly E[],
  parsed: readonly P[],
  keyOfExisting: (item: E) => string | undefined,
  keyOfParsed: (item: P) => string | undefined,
  usedE: Set<number>,
  usedP: Set<number>,
): Pair[] {
  const pairs: Pair[] = [];
  for (const how of ['exact', 'case'] as const) {
    const bucket = new Map<string, number[]>();
    existing.forEach((item, i) => {
      if (usedE.has(i)) return;
      const key = keyOfExisting(item);
      if (key === undefined) return;
      const k = how === 'exact' ? key : lower(key);
      bucket.set(k, [...(bucket.get(k) ?? []), i]);
    });
    parsed.forEach((item, j) => {
      if (usedP.has(j)) return;
      const key = keyOfParsed(item);
      if (key === undefined) return;
      const list = bucket.get(how === 'exact' ? key : lower(key));
      const i = list?.shift();
      if (i === undefined) return;
      usedE.add(i);
      usedP.add(j);
      pairs.push({ existing: i, parsed: j, how });
    });
  }
  return pairs;
}

const free = (size: number, used: ReadonlySet<number>) =>
  Array.from({ length: size }, (_, i) => i).filter((i) => !used.has(i));

function finish(
  pairs: Pair[],
  existingSize: number,
  parsedSize: number,
  usedE: ReadonlySet<number>,
  usedP: ReadonlySet<number>,
): Matching {
  return {
    pairs: pairs.sort((a, b) => a.parsed - b.parsed),
    added: free(parsedSize, usedP),
    removed: free(existingSize, usedE),
  };
}

export interface TableShape {
  name: string;
  /** Normalised: no `public`. */
  schema?: string;
  columns: readonly string[];
}

/** `schema.name`, lower case: the key of the session memory and of the name match. */
export const tableKey = (table: Pick<TableShape, 'name' | 'schema'>): string =>
  lower(table.schema === undefined ? table.name : `${table.schema}.${table.name}`);

export interface TableMatching extends Matching {
  /** Parsed tables restored from the session memory (their key). */
  restored: { parsed: number; key: string }[];
  /** More than one table unmatched on both sides: the text replaced them (spec edge case). */
  replaced: { removed: number[]; added: number[] } | null;
}

/**
 * Tables (R5.1): same `schema.name`, same name ignoring case, session memory, then one likely
 * rename: exactly one unmatched on each side and at least half of the parsed table's columns
 * exist in the old one (or both have at most one column). `memory` holds lower-cased keys.
 */
export function matchTables(
  existing: readonly TableShape[],
  parsed: readonly TableShape[],
  memory: ReadonlySet<string>,
): TableMatching {
  const usedE = new Set<number>();
  const usedP = new Set<number>();
  const pairs = pairByKey(
    existing,
    parsed,
    (t) => (t.schema === undefined ? t.name : `${t.schema}.${t.name}`),
    (t) => (t.schema === undefined ? t.name : `${t.schema}.${t.name}`),
    usedE,
    usedP,
  );
  const restored: { parsed: number; key: string }[] = [];
  parsed.forEach((table, j) => {
    if (usedP.has(j)) return;
    const key = tableKey(table);
    if (!memory.has(key) || restored.some((r) => r.key === key)) return;
    usedP.add(j);
    restored.push({ parsed: j, key });
  });
  const loneE = free(existing.length, usedE);
  const loneP = free(parsed.length, usedP);
  let replaced: TableMatching['replaced'] = null;
  const [oldIndex] = loneE;
  const [newIndex] = loneP;
  const oldTable = oldIndex === undefined ? undefined : existing[oldIndex];
  const newTable = newIndex === undefined ? undefined : parsed[newIndex];
  if (
    loneE.length === 1 &&
    loneP.length === 1 &&
    oldIndex !== undefined &&
    newIndex !== undefined &&
    oldTable !== undefined &&
    newTable !== undefined &&
    isLikelyRename(oldTable.columns, newTable.columns)
  ) {
    usedE.add(oldIndex);
    usedP.add(newIndex);
    pairs.push({ existing: oldIndex, parsed: newIndex, how: 'rename' });
  } else if (loneE.length >= 2 && loneP.length >= 2) {
    replaced = { removed: loneE, added: loneP };
  }
  return { ...finish(pairs, existing.length, parsed.length, usedE, usedP), restored, replaced };
}

function isLikelyRename(oldColumns: readonly string[], newColumns: readonly string[]): boolean {
  if (oldColumns.length <= 1 && newColumns.length <= 1) return true;
  if (newColumns.length === 0) return false;
  const known = new Set(oldColumns.map(lower));
  const shared = newColumns.filter((name) => known.has(lower(name))).length;
  return shared * 2 >= newColumns.length;
}

export interface ColumnShape {
  name: string;
  /** The type as compared: base name lower case, no size. */
  type: string;
}

/**
 * Columns of one matched table (R5.2): same name, same name ignoring case, then a rename: the
 * unmatched old and new columns are paired one-to-one when they sit at the same position among
 * the unmatched ones and have the same type, or when exactly one old and one new are unmatched.
 */
export function matchColumns(
  existing: readonly ColumnShape[],
  parsed: readonly ColumnShape[],
): Matching {
  const usedE = new Set<number>();
  const usedP = new Set<number>();
  const pairs = pairByKey(
    existing,
    parsed,
    (c) => c.name,
    (c) => c.name,
    usedE,
    usedP,
  );
  pairRenames(existing, parsed, usedE, usedP, pairs, (a, b) => lower(a.type) === lower(b.type));
  return finish(pairs, existing.length, parsed.length, usedE, usedP);
}

function pairRenames<E, P>(
  existing: readonly E[],
  parsed: readonly P[],
  usedE: Set<number>,
  usedP: Set<number>,
  pairs: Pair[],
  sameKind: (e: E, p: P) => boolean,
): void {
  const loneE = free(existing.length, usedE);
  const loneP = free(parsed.length, usedP);
  if (loneE.length === 1 && loneP.length === 1) {
    const [i] = loneE;
    const [j] = loneP;
    if (i !== undefined && j !== undefined) {
      usedE.add(i);
      usedP.add(j);
      pairs.push({ existing: i, parsed: j, how: 'rename' });
    }
    return;
  }
  const count = Math.min(loneE.length, loneP.length);
  for (let k = 0; k < count; k++) {
    const i = loneE[k];
    const j = loneP[k];
    const e = i === undefined ? undefined : existing[i];
    const p = j === undefined ? undefined : parsed[j];
    if (i === undefined || j === undefined || e === undefined || p === undefined) continue;
    if (!sameKind(e, p)) continue;
    usedE.add(i);
    usedP.add(j);
    pairs.push({ existing: i, parsed: j, how: 'rename' });
  }
}

export interface EnumShape {
  name: string;
  schema?: string;
  values: readonly string[];
}

/**
 * Enums (R5.3): same name, same name ignoring case, then one likely rename (exactly one
 * unmatched on each side that share at least half of the parsed values).
 */
export function matchEnums(existing: readonly EnumShape[], parsed: readonly EnumShape[]): Matching {
  const usedE = new Set<number>();
  const usedP = new Set<number>();
  const keyOf = (e: EnumShape) => (e.schema === undefined ? e.name : `${e.schema}.${e.name}`);
  const pairs = pairByKey(existing, parsed, keyOf, keyOf, usedE, usedP);
  const loneE = free(existing.length, usedE);
  const loneP = free(parsed.length, usedP);
  const [i] = loneE;
  const [j] = loneP;
  const oldEnum = i === undefined ? undefined : existing[i];
  const newEnum = j === undefined ? undefined : parsed[j];
  if (
    loneE.length === 1 &&
    loneP.length === 1 &&
    i !== undefined &&
    j !== undefined &&
    oldEnum !== undefined &&
    newEnum !== undefined &&
    isLikelyRename(oldEnum.values, newEnum.values)
  ) {
    usedE.add(i);
    usedP.add(j);
    pairs.push({ existing: i, parsed: j, how: 'rename' });
  }
  return finish(pairs, existing.length, parsed.length, usedE, usedP);
}

/** Enum values (R5.3): name, name ignoring case, then one-to-one by position among the rest. */
export function matchValues(existing: readonly string[], parsed: readonly string[]): Matching {
  const usedE = new Set<number>();
  const usedP = new Set<number>();
  const pairs = pairByKey(
    existing,
    parsed,
    (v) => v,
    (v) => v,
    usedE,
    usedP,
  );
  pairRenames(existing, parsed, usedE, usedP, pairs, () => true);
  return finish(pairs, existing.length, parsed.length, usedE, usedP);
}

export interface IndexShape {
  name?: string;
  /** The parts as a comparable text: column names in order, expressions in backticks. */
  signature: string;
}

/** Indexes (R5.4): by name when both are named; the rest by their column list. */
export function matchIndexes(
  existing: readonly IndexShape[],
  parsed: readonly IndexShape[],
): Matching {
  const usedE = new Set<number>();
  const usedP = new Set<number>();
  const pairs = pairByKey(
    existing,
    parsed,
    (x) => x.name,
    (x) => x.name,
    usedE,
    usedP,
  );
  pairs.push(
    ...pairByKey(
      existing,
      parsed,
      (x) => (x.name === undefined ? x.signature : undefined),
      (x) => (x.name === undefined ? x.signature : undefined),
      usedE,
      usedP,
    ),
  );
  // A named index whose name changed in the text, same parts: the same index, renamed.
  pairs.push(
    ...pairByKey(
      existing,
      parsed,
      (x) => x.signature,
      (x) => x.signature,
      usedE,
      usedP,
    ).map((pair) => ({ ...pair, how: 'rename' as const })),
  );
  return finish(pairs, existing.length, parsed.length, usedE, usedP);
}

export interface CheckShape {
  name?: string;
  expr: string;
}

/** Checks (R5.4): by name, then by expression. */
export function matchChecks(
  existing: readonly CheckShape[],
  parsed: readonly CheckShape[],
): Matching {
  const usedE = new Set<number>();
  const usedP = new Set<number>();
  const pairs = pairByKey(
    existing,
    parsed,
    (x) => x.name,
    (x) => x.name,
    usedE,
    usedP,
  );
  pairs.push(
    ...pairByKey(
      existing,
      parsed,
      (x) => x.expr.trim().replace(/\s+/g, ' '),
      (x) => x.expr.trim().replace(/\s+/g, ' '),
      usedE,
      usedP,
    ),
  );
  return finish(pairs, existing.length, parsed.length, usedE, usedP);
}

export interface RelationshipShape {
  name?: string;
  /** Table and column ids of both ends, after table and column matching. */
  signature: string;
}

/** Relationships (R5.5): by the ordered pair of ends, then by name. */
export function matchRelationships(
  existing: readonly RelationshipShape[],
  parsed: readonly RelationshipShape[],
): Matching {
  const usedE = new Set<number>();
  const usedP = new Set<number>();
  const pairs = pairByKey(
    existing,
    parsed,
    (x) => x.signature,
    (x) => x.signature,
    usedE,
    usedP,
  );
  pairs.push(
    ...pairByKey(
      existing,
      parsed,
      (x) => x.name,
      (x) => x.name,
      usedE,
      usedP,
    ).map((pair) => ({ ...pair, how: 'rename' as const })),
  );
  return finish(pairs, existing.length, parsed.length, usedE, usedP);
}

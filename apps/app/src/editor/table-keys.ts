/**
 * Deck-level values every table card reads (041, research R3, R12), derived once per deck snapshot
 * and cached by the identity of the lists they come from, so a 150-table board derives them once
 * per edit, not once per card.
 */
import { isDbTable, tableDisplayOf, type ResolvedTableDisplay } from '@sododeck/model';
import type { DbDetail, DbEnum, Id, SododeckFile } from '@sododeck/schema';

type Deck = Pick<SododeckFile, 'nodes' | 'edges'>;
type Edge = SododeckFile['edges'][number];

const EMPTY_SET: ReadonlySet<Id> = new Set();

/** The column ids an edge marks as foreign keys: its referencing end (the `n` side, else `from`). */
function referencingEnd(edge: Edge): { table: Id; columns: readonly Id[] | undefined } {
  return edge.cardinality === '1-n'
    ? { table: edge.to, columns: edge.toColumns }
    : { table: edge.from, columns: edge.fromColumns };
}

const fkCache = new WeakMap<
  readonly Edge[],
  WeakMap<Deck['nodes'], ReadonlyMap<Id, ReadonlySet<Id>>>
>();

/** Foreign-key columns per table: column ends on the referencing side of a relationship. */
export function fkColumns(deck: Deck): ReadonlyMap<Id, ReadonlySet<Id>> {
  const byNodes = fkCache.get(deck.edges);
  const known = byNodes?.get(deck.nodes);
  if (known !== undefined) return known;
  const tables = new Set(deck.nodes.filter(isDbTable).map((node) => node.id));
  const map = new Map<Id, Set<Id>>();
  for (const edge of deck.edges) {
    const end = referencingEnd(edge);
    if (end.columns === undefined || !tables.has(end.table)) continue;
    let set = map.get(end.table);
    if (set === undefined) {
      set = new Set();
      map.set(end.table, set);
    }
    for (const column of end.columns) set.add(column);
  }
  const next = byNodes ?? new WeakMap();
  next.set(deck.nodes, map);
  fkCache.set(deck.edges, next);
  return map;
}

const connectedCache = new WeakMap<
  readonly Edge[],
  WeakMap<Deck['nodes'], ReadonlyMap<Id, ReadonlySet<Id>>>
>();

/**
 * Every column that is a relationship end, on either side, per table (042 R15): Keys detail keeps
 * these rows so a relationship never loses its row. Ends on cards that are not tables are ignored.
 */
export function connectedColumns(deck: Deck): ReadonlyMap<Id, ReadonlySet<Id>> {
  const byNodes = connectedCache.get(deck.edges);
  const known = byNodes?.get(deck.nodes);
  if (known !== undefined) return known;
  const tables = new Set(deck.nodes.filter(isDbTable).map((node) => node.id));
  const map = new Map<Id, Set<Id>>();
  const add = (table: Id, columns: readonly Id[] | undefined) => {
    if (columns === undefined || columns.length === 0 || !tables.has(table)) return;
    let set = map.get(table);
    if (set === undefined) {
      set = new Set();
      map.set(table, set);
    }
    for (const column of columns) set.add(column);
  };
  for (const edge of deck.edges) {
    add(edge.from, edge.fromColumns);
    add(edge.to, edge.toColumns);
  }
  const next = byNodes ?? new WeakMap();
  next.set(deck.nodes, map);
  connectedCache.set(deck.edges, next);
  return map;
}

/** One table's foreign-key columns (empty when it has none). */
export function fkColumnsOf(deck: Deck, tableId: Id): ReadonlySet<Id> {
  return fkColumns(deck).get(tableId) ?? EMPTY_SET;
}

const schemaCache = new WeakMap<Deck['nodes'], number>();

/** Distinct non-empty `schema` names of the deck's tables. */
export function schemaCount(deck: Pick<SododeckFile, 'nodes'>): number {
  const known = schemaCache.get(deck.nodes);
  if (known !== undefined) return known;
  const names = new Set<string>();
  for (const node of deck.nodes) {
    if (isDbTable(node) && node.schema !== undefined && node.schema !== '') names.add(node.schema);
  }
  schemaCache.set(deck.nodes, names.size);
  return names.size;
}

const EMPTY_ENUMS: ReadonlyMap<Id, DbEnum> = new Map();
const enumCache = new WeakMap<readonly DbEnum[], ReadonlyMap<Id, DbEnum>>();

/** The deck's enums by id. */
export function enumById(deck: Pick<SododeckFile, 'enums'>): ReadonlyMap<Id, DbEnum> {
  if (deck.enums === undefined) return EMPTY_ENUMS;
  const known = enumCache.get(deck.enums);
  if (known !== undefined) return known;
  const map = new Map(deck.enums.map((item) => [item.id, item]));
  enumCache.set(deck.enums, map);
  return map;
}

/** What a table card reads of its deck besides its own node. */
export interface TableContext {
  fk: ReadonlyMap<Id, ReadonlySet<Id>>;
  /** Relationship-end columns per table (042); absent means none. */
  connected?: ReadonlyMap<Id, ReadonlySet<Id>>;
  /** Two or more schemas: headers read "Table · <schema>". */
  showSchema: boolean;
  enums: ReadonlyMap<Id, DbEnum>;
  display: ResolvedTableDisplay;
}

function sameDisplay(a: ResolvedTableDisplay, b: ResolvedTableDisplay): boolean {
  return (
    a.detail === b.detail &&
    a.hideTypes === b.hideTypes &&
    a.hideNullable === b.hideNullable &&
    a.hideNotes === b.hideNotes &&
    a.hideIndexes === b.hideIndexes
  );
}

function withViewDetail(
  display: ResolvedTableDisplay,
  detail: DbDetail | undefined,
): ResolvedTableDisplay {
  return detail === undefined || detail === display.detail ? display : { ...display, detail };
}

let lastContext: TableContext | undefined;

/**
 * The table context of a deck. The same object comes back while every part is unchanged, so
 * per-node caches keyed on it survive edits that do not touch tables.
 */
export function tableContextOf(
  deck: Pick<SododeckFile, 'nodes' | 'edges' | 'enums' | 'tableDisplay'>,
  /** The current view's detail (048): it replaces the deck's, a table's own choice still wins. */
  viewDetail?: DbDetail,
): TableContext {
  const next: TableContext = {
    fk: fkColumns(deck),
    connected: connectedColumns(deck),
    showSchema: schemaCount(deck) >= 2,
    enums: enumById(deck),
    display: withViewDetail(tableDisplayOf(deck), viewDetail),
  };
  const last = lastContext;
  if (
    last?.fk === next.fk &&
    last.connected === next.connected &&
    last.showSchema === next.showSchema &&
    last.enums === next.enums &&
    sameDisplay(last.display, next.display)
  ) {
    return last;
  }
  lastContext = next;
  return next;
}

let currentContext: TableContext = tableContextOf({ nodes: [], edges: [] });

/**
 * The deck whose tables the canvas draws (041). Card sizes are read in many places that hold only
 * a node (edges, group frames, drags); `viewStateOf` sets this, as it does `setCardFieldDeck`.
 */
export function setTableDeck(
  deck: Pick<SododeckFile, 'nodes' | 'edges' | 'enums' | 'tableDisplay'>,
  viewDetail?: DbDetail,
): void {
  currentContext = tableContextOf(deck, viewDetail);
}

/** The context set by `setTableDeck`. */
export function currentTableContext(): TableContext {
  return currentContext;
}

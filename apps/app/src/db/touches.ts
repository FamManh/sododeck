/**
 * What a flow step reads or writes (049, ADR 0035), derived for playback: the touched tables and
 * columns, the chip a database card shows at architecture level, and the step player's notes for
 * tables the canvas cannot light. Pure and computed from the deck and the step; nothing is stored.
 */
import type { TouchAccess } from '@sododeck/model';
import type { Id, SododeckFile, Step } from '@sododeck/schema';

type Node = SododeckFile['nodes'][number];

export interface TouchSets {
  /** Touched tables in first-touch order; a write anywhere on the table beats a read. */
  tables: ReadonlyMap<Id, TouchAccess>;
  /** Touched columns with their access. */
  columns: ReadonlyMap<Id, TouchAccess>;
  /** Touched columns per table: the rows a table must draw and mark (R / W). */
  byTable: ReadonlyMap<Id, ReadonlyMap<Id, TouchAccess>>;
  /** The same as sets of column ids, the forced rows `tableLayout` takes. */
  rows: ReadonlyMap<Id, ReadonlySet<Id>>;
}

const EMPTY_SETS: TouchSets = {
  tables: new Map(),
  columns: new Map(),
  byTable: new Map(),
  rows: new Map(),
};
const setsCache = new WeakMap<Step, TouchSets>();

/**
 * The touched tables and columns of a step. A column touch also touches its table. Cached per
 * step object: the snapshot keeps a step's identity while it is unchanged, so this runs once per
 * (deck version, step) however often the canvas renders.
 */
export function touchSets(step: Pick<Step, 'touches'> | null | undefined): TouchSets {
  if (step?.touches === undefined || step.touches.length === 0) return EMPTY_SETS;
  const cached = setsCache.get(step as Step);
  if (cached !== undefined) return cached;
  const tables = new Map<Id, TouchAccess>();
  const columns = new Map<Id, TouchAccess>();
  const byTable = new Map<Id, Map<Id, TouchAccess>>();
  for (const touch of step.touches) {
    if (tables.get(touch.table) !== 'write') tables.set(touch.table, touch.access);
    if (touch.column === undefined) continue;
    columns.set(touch.column, touch.access);
    const own = byTable.get(touch.table) ?? new Map<Id, TouchAccess>();
    own.set(touch.column, touch.access);
    byTable.set(touch.table, own);
  }
  const rows = new Map<Id, ReadonlySet<Id>>(
    [...byTable].map(([tableId, own]) => [tableId, new Set(own.keys())]),
  );
  const sets = { tables, columns, byTable, rows };
  setsCache.set(step as Step, sets);
  return sets;
}

/** Touched table ids → access (write beats read), in first-touch order. */
export function touchedTables(step: Pick<Step, 'touches'> | null | undefined) {
  return touchSets(step).tables;
}

/** Touched column ids → access. */
export function touchedColumns(step: Pick<Step, 'touches'> | null | undefined) {
  return touchSets(step).columns;
}

const VERB: Record<TouchAccess, string> = { read: 'reads', write: 'writes' };

export interface ChipTable {
  title: string;
  access: TouchAccess;
}

export interface TouchChip {
  /** "writes orders +1": the verb keeps read and write apart without colour. */
  text: string;
  /** Access of the first named table. */
  access: TouchAccess;
  /** Every touched table the chip stands for, in step order (so chips can be merged). */
  tables: readonly ChipTable[];
}

/** Chip text for touched tables in step order: the first one by name, "+n" for the rest. */
export function chipOf(tables: readonly ChipTable[]): TouchChip | null {
  const first = tables[0];
  if (first === undefined) return null;
  const more = tables.length - 1;
  return {
    text: `${VERB[first.access]} ${first.title}${more > 0 ? ` +${String(more)}` : ''}`,
    access: first.access,
    tables,
  };
}

/** One chip for several cards' chips, in the order given (a collapsed group's cards). */
export function mergeChips(chips: readonly TouchChip[]): TouchChip | null {
  return chips.length === 1 ? (chips[0] ?? null) : chipOf(chips.flatMap((chip) => chip.tables));
}

/** The touched tables of `step` owned by any of `cardIds`, in step order. */
function ownedTouches(
  deck: Pick<SododeckFile, 'nodes'>,
  cardIds: ReadonlySet<Id>,
  step: Pick<Step, 'touches'> | null | undefined,
): ChipTable[] {
  const tables = touchedTables(step);
  if (tables.size === 0) return [];
  const byId = new Map(deck.nodes.map((node) => [node.id, node]));
  const out: ChipTable[] = [];
  for (const [tableId, access] of tables) {
    const table = byId.get(tableId);
    if (table?.parent !== undefined && cardIds.has(table.parent)) {
      out.push({ title: table.title, access });
    }
  }
  return out;
}

/** The chip a database card shows on the current step ("writes orders +1"); null when untouched. */
export function cardChip(
  deck: Pick<SododeckFile, 'nodes'>,
  cardId: Id,
  step: Pick<Step, 'touches'> | null | undefined,
): TouchChip | null {
  return chipOf(ownedTouches(deck, new Set([cardId]), step));
}

/** One chip for several cards, e.g. the database cards folded into a collapsed group. */
export function mergedChip(
  deck: Pick<SododeckFile, 'nodes'>,
  cardIds: ReadonlySet<Id>,
  step: Pick<Step, 'touches'> | null | undefined,
): TouchChip | null {
  return chipOf(ownedTouches(deck, cardIds, step));
}

export interface PlayerNote {
  /** "Customers DB · customers", or the table name for a table no card owns. */
  label: string;
  /** The table, or its card, is left out by the current view's filter. */
  hidden: boolean;
}

/** What the canvas shows right now, as ids. */
export interface ShownIds {
  /** Node ids drawn, or represented by a collapsed group's card, at the current drill level. */
  drawn: ReadonlySet<Id>;
  /** Node ids the current view keeps (its filter hides the rest). */
  inView: ReadonlySet<Id>;
}

/**
 * Touched tables the canvas cannot light, for the step player. A table drawn here is lit; a table
 * whose database card is drawn shows on the card's chip. Every other touched table is named: by
 * card and table when it has an owner, by name alone when it has none, and flagged when the
 * view's filter hides it. The view itself is never changed.
 */
export function playerNotes(
  deck: Pick<SododeckFile, 'nodes'>,
  step: Pick<Step, 'touches'> | null | undefined,
  shown: ShownIds,
): PlayerNote[] {
  const tables = touchedTables(step);
  if (tables.size === 0) return [];
  const byId = new Map<Id, Node>(deck.nodes.map((node) => [node.id, node]));
  const notes: PlayerNote[] = [];
  for (const tableId of tables.keys()) {
    const table = byId.get(tableId);
    if (table === undefined || shown.drawn.has(tableId)) continue;
    const owner = table.parent === undefined ? undefined : byId.get(table.parent);
    const ownerIsCard = owner?.type === 'database';
    if (ownerIsCard && shown.drawn.has(owner.id)) continue;
    const hidden = !shown.inView.has(tableId) || (ownerIsCard && !shown.inView.has(owner.id));
    notes.push({ label: ownerIsCard ? `${owner.title} · ${table.title}` : table.title, hidden });
  }
  return notes;
}

/** The player line: "Also touches: Customers DB · customers, invoices (hidden in this view)". */
export function playerNoteText(notes: readonly PlayerNote[]): string | null {
  if (notes.length === 0) return null;
  const parts = notes.map((note) =>
    note.hidden ? `${note.label} (hidden in this view)` : note.label,
  );
  return `Also touches: ${parts.join(', ')}`;
}

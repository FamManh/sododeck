/**
 * Draw-time connection rules (spec FR-010, research R4). The model accepts duplicates (imported
 * files, 015 reports them); the canvas refuses to draw them. A pair connected in either
 * direction counts as a duplicate.
 *
 * Ends are nodes, groups or notes (050 R6, 053). A note is never inside a group, so it only
 * meets the self and duplicate rules.
 *
 * Ends were nodes or groups (050 R6). A group can't connect to anything inside it, at any depth,
 * nor anything to a group that holds it (`'contains'`). A file that already has such a connector
 * is drawn and allowed; only new connections and reconnects are refused.
 */
import { endpointOf, isDbTable, stickyLabel } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

import { cardIconRef } from './card-icon';

export type ConnectionCheck = 'ok' | 'self' | 'duplicate' | 'contains';

export const REFUSAL_TEXT: Record<Exclude<ConnectionCheck, 'ok'>, string> = {
  self: "Can't connect to itself",
  duplicate: 'Already connected',
  contains: "Can't connect a group to something inside it",
};

type Ends = Pick<SododeckFile, 'nodes' | 'groups'>;

/** What an untitled note is called in lists (the same words the search index uses). */
const EMPTY_NOTE_TITLE = 'Empty note';

/** The groups holding `id` (a node or a group), innermost first; stops on a parent cycle. */
function enclosingGroups(deck: Ends, id: string): Set<string> {
  const parentOf = new Map(deck.groups.map((g) => [g.id, g.parent]));
  const out = new Set<string>();
  let current = parentOf.has(id) ? parentOf.get(id) : deck.nodes.find((n) => n.id === id)?.group;
  while (current !== undefined && current !== id && !out.has(current) && parentOf.has(current)) {
    out.add(current);
    current = parentOf.get(current);
  }
  return out;
}

/** Whether one end is a group that holds the other, at any depth. */
function contains(deck: Ends, a: string, b: string): boolean {
  return enclosingGroups(deck, b).has(a) || enclosingGroups(deck, a).has(b);
}

/** Whether a new edge `from` → `to` may be drawn; `ignoreEdgeId` is the edge being reconnected. */
export function connectionCheck(
  deck: SododeckFile,
  from: string,
  to: string,
  ignoreEdgeId?: string,
): ConnectionCheck {
  if (from === to) return 'self';
  if (deck.groups.length > 0 && contains(deck, from, to)) return 'contains';
  const duplicate = deck.edges.some(
    (e) =>
      e.id !== ignoreEdgeId &&
      ((e.from === from && e.to === to) || (e.from === to && e.to === from)),
  );
  return duplicate ? 'duplicate' : 'ok';
}

/** One end of a relationship being drawn (042). */
export interface ColumnEnd {
  tableId: string;
  columnId: string;
}

export type ColumnConnectionCheck = { ok: true } | { ok: false; existing?: string };

/**
 * Whether a relationship `from` → `to` may be drawn from columns (042 R12). Unlike card
 * connections, a table may reference itself and two tables may share several relationships;
 * only the source row itself and the same column pair in the same direction are refused (the
 * latter returns that relationship, so the canvas selects it). `ignoreEdgeId` is the edge being
 * reconnected.
 */
export function columnConnectionCheck(
  deck: Pick<SododeckFile, 'edges'>,
  from: ColumnEnd,
  to: ColumnEnd,
  ignoreEdgeId?: string,
): ColumnConnectionCheck {
  if (from.tableId === to.tableId && from.columnId === to.columnId) return { ok: false };
  const existing = deck.edges.find(
    (e) =>
      e.id !== ignoreEdgeId &&
      e.from === from.tableId &&
      e.to === to.tableId &&
      e.fromColumns?.length === 1 &&
      e.fromColumns[0] === from.columnId &&
      e.toColumns?.length === 1 &&
      e.toColumns[0] === to.columnId,
  );
  return existing === undefined ? { ok: true } : { ok: false, existing: existing.id };
}

export interface ConnectTarget {
  id: string;
  title: string;
  /** The node's type, `'group'` for a group (050), `'note'` for a sticky (053) or `'image'` for a picture (055). */
  kind: string;
  /** The node's stored icon, when it draws as a card (038). */
  icon?: string;
  disabled: boolean;
  reason?: 'already connected' | 'inside';
}

/** Options for keyboard connect: every other card, group and note, filtered by title, sorted by title. */
export function connectTargets(deck: SododeckFile, fromId: string, query: string): ConnectTarget[] {
  const needle = query.trim().toLowerCase();
  const option = (base: Omit<ConnectTarget, 'disabled' | 'reason'>): ConnectTarget => {
    const check = connectionCheck(deck, fromId, base.id);
    if (check === 'ok') return { ...base, disabled: false };
    return {
      ...base,
      disabled: true,
      reason: check === 'contains' ? 'inside' : 'already connected',
    };
  };
  const matches = (title: string, id: string) =>
    id !== fromId && title.toLowerCase().includes(needle);
  const nodes = deck.nodes
    .filter((n) => matches(n.title, n.id))
    .map((n) => {
      const icon = cardIconRef(n);
      return option({
        id: n.id,
        title: n.title,
        kind: n.type,
        ...(icon === undefined ? {} : { icon }),
      });
    });
  const groups = deck.groups
    .filter((g) => matches(g.title, g.id))
    .map((g) => option({ id: g.id, title: g.title, kind: 'group' }));
  const notes = deck.stickies
    .map((s) => ({ id: s.id, title: stickyLabel(s.text) ?? EMPTY_NOTE_TITLE }))
    .filter((s) => matches(s.title, s.id))
    .map((s) => option({ id: s.id, title: s.title, kind: 'note' }));
  const images = (deck.images ?? [])
    .map((i) => ({ id: i.id, title: endpointOf(deck, i.id)?.title ?? 'Image' }))
    .filter((i) => matches(i.title, i.id))
    .map((i) => option({ id: i.id, title: i.title, kind: 'image' }));
  return [...nodes, ...groups, ...notes, ...images].sort(
    (a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  );
}

export interface ColumnTarget extends ColumnEnd {
  /** "customers.id". */
  label: string;
  disabled: boolean;
}

/**
 * Options for keyboard relationship creation (042 R9): every column of every table as
 * "table.column", primary keys first, then the rest, each by label; filtered by `query`; the source
 * row left out and an existing same-direction pair disabled.
 */
export function columnConnectTargets(
  deck: SododeckFile,
  source: ColumnEnd,
  query: string,
): ColumnTarget[] {
  const needle = query.trim().toLowerCase();
  const options = deck.nodes.flatMap((node) =>
    isDbTable(node)
      ? (node.columns ?? []).map((column) => ({
          tableId: node.id,
          columnId: column.id,
          label: `${node.title}.${column.name}`,
          key: column.pk === true,
        }))
      : [],
  );
  return options
    .filter(
      (option) =>
        !(option.tableId === source.tableId && option.columnId === source.columnId) &&
        option.label.toLowerCase().includes(needle),
    )
    .sort((a, b) => Number(b.key) - Number(a.key) || a.label.localeCompare(b.label))
    .map((option) => ({
      tableId: option.tableId,
      columnId: option.columnId,
      label: option.label,
      disabled: !columnConnectionCheck(deck, source, option).ok,
    }));
}

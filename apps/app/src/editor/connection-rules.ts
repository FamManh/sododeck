/**
 * Draw-time connection rules (spec FR-010, research R4). The model accepts duplicates (imported
 * files, 015 reports them); the canvas refuses to draw them. A pair connected in either
 * direction counts as a duplicate.
 */
import { isDbTable } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

import { cardIconRef } from './card-icon';

export type ConnectionCheck = 'ok' | 'self' | 'duplicate';

export const REFUSAL_TEXT: Record<Exclude<ConnectionCheck, 'ok'>, string> = {
  self: "Can't connect to itself",
  duplicate: 'Already connected',
};

/** Whether a new edge `from` → `to` may be drawn; `ignoreEdgeId` is the edge being reconnected. */
export function connectionCheck(
  deck: SododeckFile,
  from: string,
  to: string,
  ignoreEdgeId?: string,
): ConnectionCheck {
  if (from === to) return 'self';
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
  kind: string;
  /** The node's stored icon, when it draws as a card (038). */
  icon?: string;
  disabled: boolean;
  reason?: 'already connected';
}

/** Options for keyboard connect: every other component, filtered by title, sorted by title. */
export function connectTargets(deck: SododeckFile, fromId: string, query: string): ConnectTarget[] {
  const needle = query.trim().toLowerCase();
  return deck.nodes
    .filter((n) => n.id !== fromId && n.title.toLowerCase().includes(needle))
    .map((n): ConnectTarget => {
      const disabled = connectionCheck(deck, fromId, n.id) !== 'ok';
      const icon = cardIconRef(n);
      const base = {
        id: n.id,
        title: n.title,
        kind: n.type,
        ...(icon === undefined ? {} : { icon }),
      };
      return disabled ? { ...base, disabled, reason: 'already connected' } : { ...base, disabled };
    })
    .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
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

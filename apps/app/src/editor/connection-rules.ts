/**
 * Draw-time connection rules (spec FR-010, research R4). The model accepts duplicates (imported
 * files, 015 reports them); the canvas refuses to draw them. A pair connected in either
 * direction counts as a duplicate.
 *
 * Ends are nodes or groups (050 R6). A group can't connect to anything inside it, at any depth,
 * nor anything to a group that holds it (`'contains'`). A file that already has such a connector
 * is drawn and allowed; only new connections and reconnects are refused.
 */
import type { SododeckFile } from '@sododeck/schema';

import { cardIconRef } from './card-icon';

export type ConnectionCheck = 'ok' | 'self' | 'duplicate' | 'contains';

export const REFUSAL_TEXT: Record<Exclude<ConnectionCheck, 'ok'>, string> = {
  self: "Can't connect to itself",
  duplicate: 'Already connected',
  contains: "Can't connect a group to something inside it",
};

type Ends = Pick<SododeckFile, 'nodes' | 'groups'>;

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

export interface ConnectTarget {
  id: string;
  title: string;
  /** The node's type, or `'group'` for a group (050). */
  kind: string;
  /** The node's stored icon, when it draws as a card (038). */
  icon?: string;
  disabled: boolean;
  reason?: 'already connected' | 'inside';
}

/** Options for keyboard connect: every other card and group, filtered by title, sorted by title. */
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
  return [...nodes, ...groups].sort(
    (a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  );
}

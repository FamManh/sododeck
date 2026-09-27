/**
 * Draw-time connection rules (spec FR-010, research R4). The model accepts duplicates (imported
 * files, 015 reports them); the canvas refuses to draw them. A pair connected in either
 * direction counts as a duplicate.
 */
import type { SododeckFile } from '@sododeck/schema';

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

export interface ConnectTarget {
  id: string;
  title: string;
  kind: string;
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
      return disabled
        ? { id: n.id, title: n.title, kind: n.type, disabled, reason: 'already connected' }
        : { id: n.id, title: n.title, kind: n.type, disabled };
    })
    .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}

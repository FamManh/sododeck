/**
 * Deciding what a changed file means for the open canvas (070 R9, US3). Pure and by content only:
 * never by timestamp, so a write we made ourselves, a sync that rewrites the same bytes and a
 * user edit outside the owned region all compare equal and send nothing.
 */
import type { Decoded } from './file-codec';

export interface Known {
  /** The deck text the canvas holds (last sent to it or received from it). */
  canvas: string | undefined;
  /** The deck text of our last finished write. */
  written: string | undefined;
  /** The deck text of the write in flight. */
  inFlight: string | undefined;
}

export type Verdict =
  /** Nothing the canvas does not already have. */
  | { kind: 'ignore' }
  /** The deck changed under us: show it. */
  | { kind: 'external'; deckText: string }
  /** The file cannot be read as a deck: keep the canvas, write nothing until it can. */
  | { kind: 'broken'; problems: readonly { message: string; fix: string }[] };

export function judge(decoded: Decoded, known: Known): Verdict {
  if (!decoded.ok) return { kind: 'broken', problems: decoded.problems };
  const text = decoded.deckText;
  if (text === known.canvas || text === known.written || text === known.inFlight) {
    return { kind: 'ignore' };
  }
  return { kind: 'external', deckText: text };
}

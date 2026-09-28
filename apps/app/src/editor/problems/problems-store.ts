import type { DeckDoc, DeckProblems } from '@sododeck/model';

import { readDeck, subscribeDeck } from '../../model/use-deck-snapshot';
import type { ProblemsClient } from './problems-client';

/** Edits within this window are checked once (015 research R4, FR-011). */
export const PROBLEMS_DELAY_MS = 150;

export interface ProblemsStore {
  /** `null` until the first check answers. */
  get: () => DeckProblems | null;
  /** The first subscriber starts checking; the last one to leave stops it. */
  subscribe: (listener: () => void) => () => void;
}

/**
 * Derived, never stored (§g-23): the problems of the deck's latest snapshot. A check runs as soon
 * as someone subscribes; later edits are checked trailing-throttled, and a result for a snapshot
 * that a newer check has superseded is dropped. Creating the store has no side effects.
 */
export function createProblemsStore(
  doc: DeckDoc,
  client: ProblemsClient,
  { delayMs = PROBLEMS_DELAY_MS, ownsClient = false } = {},
): ProblemsStore {
  let current: DeckProblems | null = null;
  let latest = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopWatching: (() => void) | null = null;
  const listeners = new Set<() => void>();

  const run = () => {
    timer = null;
    const request = ++latest;
    client.check(readDeck(doc)).then(
      (result) => {
        if (request !== latest || stopWatching === null) return;
        current = result;
        for (const listener of listeners) listener();
      },
      () => {
        // A failed check keeps the last result; the next edit checks again.
      },
    );
  };

  const start = () => {
    stopWatching = subscribeDeck(doc, () => {
      if (timer === null) timer = setTimeout(run, delayMs);
    });
    run();
  };

  const stop = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    stopWatching?.();
    stopWatching = null;
    latest++; // drop any answer still on its way
    if (ownsClient) client.terminate();
  };

  return {
    get: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      if (listeners.size === 1) start();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stop();
      };
    },
  };
}

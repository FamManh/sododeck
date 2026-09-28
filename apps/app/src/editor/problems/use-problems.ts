import type { DeckProblems } from '@sododeck/model';
import { use, useSyncExternalStore } from 'react';

import { ProblemsContext } from './problems-context';
import type { ProblemsStore } from './problems-store';

const noStore: ProblemsStore = {
  get: () => null,
  subscribe: () => () => undefined,
};

/** The deck's problems; `null` before the first check or outside a `ProblemsProvider`. */
export function useProblems(): DeckProblems | null {
  const store = use(ProblemsContext) ?? noStore;
  return useSyncExternalStore(store.subscribe, store.get);
}

/** The store itself, for handlers that read problems without re-rendering (⌘.). */
export function useProblemsStore(): ProblemsStore | null {
  return use(ProblemsContext);
}

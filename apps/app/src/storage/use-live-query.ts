import { liveQuery } from 'dexie';
import { useMemo, useSyncExternalStore } from 'react';

function liveStore<T>(query: () => Promise<T>) {
  const observable = liveQuery(query);
  let result: T | undefined;
  return {
    subscribe: (onChange: () => void) => {
      const subscription = observable.subscribe({
        next: (value) => {
          result = value;
          onChange();
        },
        error: () => {
          // A failed read keeps the last result: the library shows what it had.
        },
      });
      return () => {
        subscription.unsubscribe();
      };
    },
    get: () => result,
  };
}

/**
 * Reads the library through Dexie `liveQuery` (research R5): re-renders when this or another tab
 * changes the tables the query read. `undefined` while the first result loads. The query is
 * recreated when `deps` change, like `useMemo`.
 */
export function useLiveQuery<T>(query: () => Promise<T>, deps: readonly unknown[]): T | undefined {
  // eslint-disable-next-line react-hooks/use-memo, react-hooks/exhaustive-deps -- the caller's deps, exactly as with useMemo; the query closure is rebuilt with them
  const store = useMemo(() => liveStore(query), deps);
  return useSyncExternalStore(store.subscribe, store.get);
}

import { useCallback, useSyncExternalStore } from 'react';

import { usePictureStore } from './picture-store';
import { acquirePicture, peekPicture, type PictureState } from './picture-url-cache';

export type { PictureState };

const MISSING: PictureState = { status: 'missing' };

/**
 * The object URL of a picture of the open deck: `loading`, then `ready` with the URL, or `missing`
 * when the store has no row for it (055). The share of the picture is taken on subscribe and
 * released on unmount.
 */
export function usePictureUrl(asset: string): PictureState {
  const store = usePictureStore();
  const subscribe = useCallback(
    (notify: () => void) => {
      if (store === null) return () => undefined;
      const handle = acquirePicture(store, asset);
      const unsubscribe = handle.subscribe(notify);
      return () => {
        unsubscribe();
        handle.release();
      };
    },
    [store, asset],
  );
  const snapshot = useCallback(
    () => (store === null ? MISSING : peekPicture(store, asset)),
    [store, asset],
  );
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

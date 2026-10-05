import { useSyncExternalStore } from 'react';

import { supportsMatchMedia } from '../../lib/features';

/** Narrow windows use the compact islands (018 FR-041, design 116). */
export const COMPACT_QUERY = '(max-width: 1279px)';

function subscribe(onChange: () => void): () => void {
  if (!supportsMatchMedia()) return () => undefined;
  const query = window.matchMedia(COMPACT_QUERY);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

const snapshot = () => supportsMatchMedia() && window.matchMedia(COMPACT_QUERY).matches;

/** The same answer outside React (store actions, fits). */
export const isCompactNow = snapshot;

/** True in a window narrower than 1280 px; false where `matchMedia` is missing. */
export function useCompactShell(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

import { toJSON, type DeckDoc } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { useCallback, useSyncExternalStore } from 'react';

/** One cached JSON snapshot per document, invalidated on every Yjs update. */
const snapshots = new WeakMap<DeckDoc, SododeckFile>();

function getSnapshot(doc: DeckDoc): SododeckFile {
  let snapshot = snapshots.get(doc);
  if (!snapshot) {
    snapshot = toJSON(doc);
    snapshots.set(doc, snapshot);
  }
  return snapshot;
}

/**
 * Subscribes a component to the deck document and returns its current JSON view.
 * Views read the document through this hook; they never keep their own copy.
 * TODO(M1): per-collection subscriptions (observeDeep) instead of a full toJSON per update.
 */
export function useDeckSnapshot(doc: DeckDoc): SododeckFile {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const handleUpdate = () => {
        snapshots.delete(doc);
        onChange();
      };
      doc.on('update', handleUpdate);
      return () => {
        doc.off('update', handleUpdate);
      };
    },
    [doc],
  );
  return useSyncExternalStore(subscribe, () => getSnapshot(doc));
}

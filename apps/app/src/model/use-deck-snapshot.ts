import { createDeckSnapshot, type DeckDoc, type DeckSnapshot } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { useSyncExternalStore } from 'react';

/** One incremental snapshot store per document, shared by every view of it. */
const stores = new WeakMap<DeckDoc, DeckSnapshot>();

function storeFor(doc: DeckDoc): DeckSnapshot {
  let store = stores.get(doc);
  if (!store) {
    store = createDeckSnapshot(doc);
    stores.set(doc, store);
  }
  return store;
}

/**
 * Subscribes a component to the deck document and returns its current JSON view.
 * Views read the document through this hook; they never keep their own copy. The snapshot is
 * structurally shared (003 research R1): objects an edit did not touch keep their identity.
 */
export function useDeckSnapshot(doc: DeckDoc): SododeckFile {
  const store = storeFor(doc);
  return useSyncExternalStore(store.subscribe, store.get);
}

/**
 * The current deck without subscribing: for event handlers and for rare checks inside
 * components that must not re-render on every edit (e.g. 500 nodes during a drag).
 */
export function readDeck(doc: DeckDoc): SododeckFile {
  return storeFor(doc).get();
}

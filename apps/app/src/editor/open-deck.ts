import { fromJSON, type DeckDoc } from '@sododeck/model';
import { emptySododeckFile } from '@sododeck/schema';
import * as Y from 'yjs';

import { storageOrigin } from '../storage/origins';
import { demoDeck } from './demo-deck';

/** Where the editor's deck comes from (research R12, R15). */
export type DeckSource =
  | { kind: 'demo' }
  /** Storage is unavailable: an empty deck that lives only in this tab. */
  | { kind: 'memory' }
  | { kind: 'stored'; bytes: readonly Uint8Array[] };

/**
 * Builds the editor's document. Loading is not an edit: stored updates are applied with the
 * storage origin, so they are neither saved again nor undoable (FR-007).
 */
export function openDeck(source: DeckSource): DeckDoc {
  switch (source.kind) {
    case 'demo':
      return fromJSON(demoDeck);
    case 'memory':
      return fromJSON({ ...emptySododeckFile(), name: 'Untitled deck' });
    case 'stored': {
      const doc = new Y.Doc();
      doc.transact(() => {
        for (const bytes of source.bytes) Y.applyUpdate(doc, bytes, storageOrigin);
      }, storageOrigin);
      return doc;
    }
  }
}

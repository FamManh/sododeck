import { fitGroupFrames, fromJSON, type DeckDoc, type DeckEditor } from '@sododeck/model';
import { emptySododeckFile, type Frame, type Id, type SododeckFile } from '@sododeck/schema';
import * as Y from 'yjs';

import { storageOrigin } from '../storage/origins';
import { cardFieldView } from './card-fields';
import { cardSize as cardSizeFor, COMPONENT_CARD_SIZE, GROUP_PADDING } from './canvas-geometry';
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

/**
 * Stores a frame for every group that has none (016 research R2): decks saved before frames
 * existed, or groups an older tab added. Fitted at the full-detail card size, so they match the
 * boxes those decks showed; views with their own positions get their own frames. Untracked: ⌘Z
 * never "unfits". Writes nothing when every group is framed.
 */
export function fitMissingFrames(editor: DeckEditor, deck: SododeckFile): void {
  const options = {
    cardSize: COMPONENT_CARD_SIZE,
    // With this deck's typed fields (032): the frame fits the cards as they are drawn.
    sizeOf: (node: SododeckFile['nodes'][number]) =>
      cardSizeFor(node, 'component', { fields: cardFieldView(deck, node) }),
    padding: GROUP_PADDING,
  };
  const base = fitGroupFrames(deck, options);
  const perView = new Map<Id, Map<Id, Frame>>();
  for (const view of deck.views) {
    if (view.positions === undefined || Object.keys(view.positions).length === 0) continue;
    const frames = fitGroupFrames(deck, { ...options, viewId: view.id });
    if (frames.size > 0) perView.set(view.id, frames);
  }
  if (base.size === 0 && perView.size === 0) return;
  editor.fillGroupFrames(base, perView);
}

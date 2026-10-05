import * as Y from 'yjs';

/**
 * Update bytes of a deck stored by a build before 036 (layout 1): collections as `Y.Array` of
 * maps holding their `id`. Built by hand, since the model can no longer write this layout.
 */
export function legacyDeckBytes(): Uint8Array {
  const doc = new Y.Doc();
  doc.transact(() => {
    const meta = doc.getMap<unknown>('meta');
    meta.set('$schema', 'https://sododeck.com/schema/v1.json');
    meta.set('version', 1);
    meta.set('name', 'Old deck');
    meta.set('description', 'Saved before 036.');
    const node = new Y.Map<unknown>();
    node.set('id', 'n1');
    node.set('type', 'service');
    node.set('title', 'Orders');
    doc.getArray('nodes').push([node]);
  });
  return Y.encodeStateAsUpdate(doc);
}

/**
 * A deck stored before ADR 0041: `current` (update bytes of a deck with a card `svc` and a note
 * `pinned`) with the note pinned to the card at the offset (10, -20), the legacy `anchor` and
 * offset written straight into the note's map as an older build did.
 */
export function pinnedNoteDeckBytes(current: Uint8Array): Uint8Array {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, current);
  const note = doc.getMap<Y.Map<unknown>>('stickies').get('pinned');
  if (note === undefined) throw new Error('the deck needs a note "pinned"');
  doc.transact(() => {
    note.set('anchor', 'svc');
    const offset = new Y.Map<unknown>();
    offset.set('x', 10);
    offset.set('y', -20);
    note.set('position', offset);
  });
  return Y.encodeStateAsUpdate(doc);
}

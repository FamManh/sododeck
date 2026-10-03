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

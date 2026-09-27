import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { createEditor, fromJSON, observeDeck, type DeckChange } from '../src';
import { seqIds } from './helpers';

const base: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'a', type: 'client', title: 'Web' },
    { id: 'b', type: 'service', title: 'Orders', position: { x: 0, y: 0 } },
  ],
  edges: [{ id: 'e1', from: 'a', to: 'b' }],
  flows: [{ id: 'fl', title: 'Flow', steps: [{ id: 's1', edge: 'e1' }] }],
  rules: {
    'R-1': {
      title: 'Carrier',
      hitPolicy: 'first',
      inputs: [{ id: 'in1', label: 'Weight' }],
      outputs: [{ id: 'out1', label: 'Carrier' }],
      rows: [{ id: 'r1', when: ['< 5'], then: ['Post'] }],
    },
  },
};

function setup() {
  const doc = fromJSON(base);
  const editor = createEditor(doc, { newId: seqIds(), captureTimeout: 0 });
  const events: DeckChange[] = [];
  const stop = observeDeck(doc, (change) => events.push(change));
  return { doc, editor, events, stop };
}

describe('observeDeck (US1 AS3, FR-002)', () => {
  it('reports one change per transaction, naming the object and the fields', () => {
    const { editor, events } = setup();
    editor.update('nodes', 'b', { title: 'Orders API', position: { x: 5, y: 5 } });
    expect(events).toEqual([
      {
        origin: 'local',
        changes: [{ scope: 'nodes', id: 'b', kind: 'updated', keys: ['position', 'title'] }],
      },
    ]);
  });

  it('reports added top-level objects', () => {
    const { editor, events } = setup();
    const id = editor.add('nodes', { type: 'queue', title: 'Q' });
    expect(events.map((e) => e.changes)).toEqual([
      [{ scope: 'nodes', id, kind: 'added', keys: [] }],
    ]);
  });

  it('reports a reorder as an update of the moved object', () => {
    const { editor, events } = setup();
    editor.reorder('nodes', 'b', 0);
    expect(events.map((e) => e.changes)).toEqual([
      [{ scope: 'nodes', id: 'b', kind: 'updated', keys: [] }],
    ]);
  });

  it('reports metadata changes', () => {
    const { editor, events } = setup();
    editor.updateMeta({ name: 'Deck' });
    expect(events.map((e) => e.changes)).toEqual([
      [{ scope: 'meta', id: '', kind: 'updated', keys: ['name'] }],
    ]);
  });

  it('reports steps as child changes', () => {
    const { editor, events } = setup();
    const step = editor.addStep('fl', { edge: 'e1' });
    editor.updateStep('fl', 's1', { title: 'Go' });
    expect(events.map((e) => e.changes)).toEqual([
      [{ scope: 'flows', id: 'fl', child: { kind: 'step', id: step }, kind: 'added', keys: [] }],
      [
        {
          scope: 'flows',
          id: 'fl',
          child: { kind: 'step', id: 's1' },
          kind: 'updated',
          keys: ['title'],
        },
      ],
    ]);
  });

  it('classifies undo, redo and remote changes', () => {
    const { doc, editor, events } = setup();
    editor.update('nodes', 'a', { title: 'Web app' });
    editor.undo();
    editor.redo();

    const other = new Y.Doc();
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));
    other.getArray<Y.Map<unknown>>('nodes').get(0).set('title', 'From another tab');
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(other, Y.encodeStateVector(doc)));

    expect(events.map((e) => e.origin)).toEqual(['local', 'undo', 'redo', 'remote']);
    for (const event of events) {
      expect(event.changes).toEqual([
        { scope: 'nodes', id: 'a', kind: 'updated', keys: ['title'] },
      ]);
    }
  });

  it('stops reporting after unsubscribe', () => {
    const { editor, events, stop } = setup();
    stop();
    editor.update('nodes', 'a', { title: 'Web app' });
    expect(events).toEqual([]);
  });
});

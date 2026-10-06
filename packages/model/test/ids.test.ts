import { emptySododeckFile, jsonSchema } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { createDeck, createEditor, DeckEditError, fromJSON, getObject, toJSON } from '../src';

/** The id pattern of format v1, read from the schema itself. */
const ID_PATTERN = new RegExp(jsonSchema.$defs.Id.pattern);

describe('generated ids (US5, FR-009/010)', () => {
  it('are valid for the format and prefixed with the object type', () => {
    const editor = createEditor(createDeck());
    const node = editor.add('nodes', { type: 'service', title: 'Orders API' });
    const group = editor.add('groups', { title: 'G' });
    const rule = editor.addRule({ title: 'R' });
    const col = editor.addRuleColumn(rule, 'inputs', 'In');
    const row = editor.addRuleRow(rule);
    const flow = editor.add('flows', { title: 'F' });
    const sticky = editor.add('stickies', { text: '', position: { x: 0, y: 0 } });
    const ids = { node, group, rule, col, row, flow, sticky };
    for (const [prefix, id] of Object.entries(ids)) {
      expect(id).toMatch(ID_PATTERN);
      expect(id).toMatch(new RegExp(`^${prefix}-[0-9a-z]{10}$`));
    }
  });

  it('are not derived from the title (AS1)', () => {
    const editor = createEditor(createDeck());
    const id = editor.add('nodes', { type: 'service', title: 'Orders API' });
    expect(id.toLowerCase()).not.toContain('orders');
    expect(id.toLowerCase()).not.toContain('api');
  });

  it('never change on rename, move, regroup or reorder (AS2, FR-010)', () => {
    const doc = fromJSON({ ...emptySododeckFile(), groups: [{ id: 'g', title: 'G' }] });
    const editor = createEditor(doc);
    const first = editor.add('nodes', { type: 'client', title: 'First' });
    const id = editor.add('nodes', { type: 'service', title: 'Orders API' });
    editor.update('nodes', id, { title: 'Orders' });
    editor.update('nodes', id, { position: { x: 5, y: 5 } });
    editor.update('nodes', id, { group: 'g' });
    editor.reorder('nodes', id, 0);
    expect(toJSON(doc).nodes.map((n) => n.id)).toEqual([id, first]);
    expect(getObject(doc, 'nodes', id)).toEqual({
      id,
      type: 'service',
      title: 'Orders',
      group: 'g',
      position: { x: 5, y: 5 },
    });
  });

  it('do not collide across 10,000 objects (AS3)', () => {
    const doc = createDeck();
    const editor = createEditor(doc);
    editor.batch(() => {
      for (let i = 0; i < 10_000; i++)
        editor.add('stickies', { text: '', position: { x: i, y: 0 } });
    });
    const ids = toJSON(doc).stickies.map((s) => s.id);
    expect(ids).toHaveLength(10_000);
    expect(new Set(ids).size).toBe(10_000);
  });

  it('retry when the generator returns an id that is already used', () => {
    const doc = fromJSON({ ...emptySododeckFile(), groups: [{ id: 'taken', title: 'G' }] });
    const queue = ['taken', 'fresh'];
    const editor = createEditor(doc, { newId: () => queue.shift() ?? 'unexpected' });
    expect(editor.add('nodes', { type: 'service', title: 'N' })).toBe('fresh');
  });

  it('refuses an explicit id used anywhere in the deck', () => {
    const doc = fromJSON({
      ...emptySododeckFile(),
      nodes: [{ id: 'a', type: 'client', title: 'A' }],
      edges: [{ id: 'e', from: 'a', to: 'a' }],
      flows: [{ id: 'f', title: 'F', steps: [{ id: 's', edge: 'e' }] }],
      rules: {
        R: {
          title: 'R',
          hitPolicy: 'first',
          inputs: [{ id: 'c', label: 'C' }],
          outputs: [],
          rows: [],
        },
      },
    });
    const editor = createEditor(doc);
    for (const id of ['a', 'e', 'f', 's', 'R', 'c']) {
      expect(() => editor.add('features', { id, title: 'X' })).toThrow(DeckEditError);
    }
  });
});

describe('id cache', () => {
  it('does not hand out an id that arrived from another tab', () => {
    const doc = createDeck();
    const editor = createEditor(doc, { newId: (prefix) => `${prefix}-x` });
    editor.add('groups', { title: 'G' }); // Fills the allocator's cache.

    const replica = new Y.Doc();
    Y.applyUpdate(replica, Y.encodeStateAsUpdate(doc));
    createEditor(replica).add('nodes', { id: 'node-x', type: 'service', title: 'Remote' });
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(replica, Y.encodeStateVector(doc)));

    expect(() => editor.add('nodes', { type: 'service', title: 'Local' })).toThrow(
      /keeps colliding/,
    );
    expect(toJSON(doc).nodes.map((n) => n.id)).toEqual(['node-x']);
  });

  it('does not hand out an explicit id written earlier in the same batch', () => {
    const doc = createDeck();
    const editor = createEditor(doc, { newId: (prefix) => `${prefix}-x` });
    editor.batch(() => {
      editor.add('nodes', { id: 'node-x', type: 'service', title: 'Pasted' });
      expect(() => editor.add('nodes', { type: 'service', title: 'New' })).toThrow(
        /keeps colliding/,
      );
    });
  });
});

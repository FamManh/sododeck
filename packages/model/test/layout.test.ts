import { emptySododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import * as Y from 'yjs';

import { createEditor, fromJSON, toJSON } from '../src';
import { tagColorsMap } from '../src/layout';
import { seqIds } from './helpers';

const nodes = (ids: string[]) => ids.map((id) => ({ id, type: 'service' as const, title: id }));

describe('appends inside one transaction (036 R3, cached last key)', () => {
  it('stays last after a move to the end in the same batch', () => {
    const doc = fromJSON({ ...emptySododeckFile(), nodes: nodes(['a', 'b', 'c']) });
    const editor = createEditor(doc, { newId: seqIds() });
    editor.batch(() => {
      editor.reorder('nodes', 'a', 2);
      editor.add('nodes', { id: 'd', type: 'service', title: 'd' });
      editor.reorder('nodes', 'b', 3);
      editor.add('nodes', { id: 'e', type: 'service', title: 'e' });
    });
    expect(toJSON(doc).nodes.map((n) => n.id)).toEqual(['c', 'a', 'd', 'b', 'e']);
  });

  it('puts a view added in the same batch as the presets after them', () => {
    const doc = fromJSON(emptySododeckFile());
    const editor = createEditor(doc, { newId: seqIds() });
    editor.batch(() => {
      editor.addView({ title: 'Mine' });
      editor.addView({ title: 'Second' });
    });
    expect(toJSON(doc).views.map((v) => v.title)).toEqual(['Overview', 'Flows', 'Mine', 'Second']);
  });

  it('keeps 10,000 appends in one batch in order', () => {
    const doc = fromJSON(emptySododeckFile());
    const editor = createEditor(doc, { newId: seqIds() });
    editor.batch(() => {
      for (let i = 0; i < 10_000; i++) editor.add('nodes', { type: 'service', title: String(i) });
    });
    const titles = toJSON(doc).nodes.map((n) => n.title);
    expect(titles).toEqual(Array.from({ length: 10_000 }, (_, i) => String(i)));
  });
});

describe('tagColorsMap (033, R2)', () => {
  it('is the stored map after fromJSON, with the file entries', () => {
    const doc = fromJSON({ ...emptySododeckFile(), tagColors: { PCI: 'violet' } });
    const map = tagColorsMap(doc);
    expect(map.doc).toBe(doc);
    expect(map.get('PCI')).toBe('violet');
  });

  it('is present and empty for a file without tag colours, and is not emitted', () => {
    const doc = fromJSON(emptySododeckFile());
    expect(tagColorsMap(doc).doc).toBe(doc);
    expect(tagColorsMap(doc).size).toBe(0);
    expect(toJSON(doc)).not.toHaveProperty('tagColors');
  });

  it('is a detached empty map for a stored document that predates it', () => {
    const doc = fromJSON(emptySododeckFile());
    doc.getMap('meta').delete('tagColors');
    const map = tagColorsMap(doc);
    expect(map).toBeInstanceOf(Y.Map);
    expect(map.doc).toBeNull();
    expect(map.size).toBe(0);
    expect(toJSON(doc)).not.toHaveProperty('tagColors');
  });
});

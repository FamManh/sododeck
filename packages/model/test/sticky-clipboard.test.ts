import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  createEditor,
  fragmentOrigin,
  fromJSON,
  parseFragment,
  serializeFragment,
  toFragment,
  toJSON,
} from '../src';
import { expectValid, seqIds } from './helpers';

const source: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'a', type: 'service', title: 'A', position: { x: 100, y: 100 } },
    { id: 'b', type: 'service', title: 'B', position: { x: 400, y: 100 } },
  ],
  stickies: [
    { id: 'free', text: 'Free note', position: { x: 20, y: 300 }, color: 'green', tags: ['x'] },
    { id: 'pinned', text: 'Pinned note', anchor: 'a', position: { x: 10, y: -50 } },
    { id: 'other', text: 'Not copied', position: { x: 900, y: 900 } },
  ],
  edges: [
    { id: 'e1', from: 'a', to: 'free' },
    { id: 'e2', from: 'free', to: 'b' },
    { id: 'e3', from: 'other', to: 'a' },
  ],
  views: [
    {
      id: 'v2',
      title: 'Second',
      type: 'custom',
      positions: { a: { x: 500, y: 500 } },
    },
  ],
};

function setup() {
  const doc = fromJSON(source);
  const editor = createEditor(doc, { newId: seqIds() });
  return { doc, editor };
}

describe('copy and paste of notes', () => {
  it('carries the selected notes and the connectors between copied items', () => {
    const fragment = toFragment(source, { nodes: ['a', 'b'], groups: [], stickies: ['free'] });
    expect(fragment.deck.stickies.map((s) => s.id)).toEqual(['free']);
    // e1 and e2 end on copied items; e3 starts on a note that is not copied.
    expect(fragment.deck.edges.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(fragment.deck.stickies[0]).toMatchObject({ color: 'green', tags: ['x'] });
  });

  it('copies a pinned note as a free note at the point it is drawn', () => {
    const fragment = toFragment(source, { nodes: [], groups: [], stickies: ['pinned'] });
    const [note] = fragment.deck.stickies;
    expect(note).not.toHaveProperty('anchor');
    expect(note?.position).toEqual({ x: 110, y: 50 });
    // In another view the note follows its card's view position.
    const inView = toFragment(
      source,
      { nodes: [], groups: [], stickies: ['pinned'] },
      { viewId: 'v2' },
    );
    expect(inView.deck.stickies[0]?.position).toEqual({ x: 510, y: 450 });
  });

  it('counts notes in the fragment origin', () => {
    const fragment = toFragment(source, { nodes: ['b'], groups: [], stickies: ['free'] });
    expect(fragmentOrigin(fragment)).toEqual({ x: 20, y: 100 });
  });

  it('round-trips through the clipboard text', () => {
    const fragment = toFragment(source, { nodes: ['a'], groups: [], stickies: ['free'] });
    expect(parseFragment(serializeFragment(fragment))).toEqual(fragment);
  });

  it('pastes notes with new ids, shifted, with connectors remapped, in one undo step', () => {
    const { doc, editor } = setup();
    const fragment = toFragment(toJSON(doc), {
      nodes: ['a', 'b'],
      groups: [],
      stickies: ['free', 'pinned'],
    });
    const pasted = editor.pasteFragment(fragment, { offset: { x: 1000, y: 0 } });
    expect(pasted.stickies).toHaveLength(2);
    const out = toJSON(doc);
    const copies = out.stickies.filter((s) => pasted.stickies.includes(s.id));
    expect(copies.map((s) => s.text)).toEqual(['Free note', 'Pinned note']);
    expect(copies[0]?.position).toEqual({ x: 1020, y: 300 });
    expect(copies[1]?.position).toEqual({ x: 1110, y: 50 });
    expect(copies[1]).not.toHaveProperty('anchor');
    const [freeCopy = ''] = pasted.stickies;
    const edges = out.edges.filter((e) => pasted.edges.includes(e.id));
    expect(edges.map((e) => [e.from, e.to])).toEqual([
      [pasted.nodes[0], freeCopy],
      [freeCopy, pasted.nodes[1]],
    ]);
    expectValid(doc);
    editor.undo();
    expect(toJSON(doc)).toEqual(toJSON(fromJSON(source)));
  });

  it('pastes a fragment holding only notes', () => {
    const { doc, editor } = setup();
    const fragment = toFragment(toJSON(doc), { nodes: [], groups: [], stickies: ['free'] });
    const pasted = editor.pasteFragment(fragment, { offset: { x: 10, y: 10 } });
    expect(pasted.stickies).toHaveLength(1);
    expect(toJSON(doc).stickies).toHaveLength(4);
  });
});

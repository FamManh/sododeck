import { describe, expect, it } from 'vitest';

import { DeckEditError, stackOrder, toJSON, topRank } from '../src';
import { expectValid } from './helpers';
import { newImage, setupDeck } from './image-helpers';

const ids = (doc: Parameters<typeof toJSON>[0]) =>
  stackOrder(toJSON(doc)).map((entry) => `${entry.kind === 'node' ? '' : 'i:'}${entry.id}`);

describe('stackOrder (055, R2)', () => {
  it('ranks by z, else by index in the collection; cards before images on a tie', () => {
    const order = stackOrder({
      nodes: [
        { id: 'a', type: 'service', title: 'a' },
        { id: 'b', type: 'service', title: 'b', z: 5 },
        { id: 'c', type: 'service', title: 'c' },
      ],
      images: [
        { id: 'i1', asset: 'x', position: { x: 0, y: 0 }, size: { width: 40, height: 40 } },
        { id: 'i2', asset: 'x', position: { x: 0, y: 0 }, size: { width: 40, height: 40 }, z: 2 },
      ],
    });
    // a: 0, i1: 0 (after card a), c: 2, i2: 2 (after card c), b: 5.
    expect(order.map((e) => e.id)).toEqual(['a', 'i1', 'c', 'i2', 'b']);
  });

  it('keeps the array order for a deck without images and without any z', () => {
    const { doc } = setupDeck();
    expect(ids(doc)).toEqual(['a', 'b', 'c']);
  });

  it('topRank is above every z and every index', () => {
    expect(topRank({ nodes: [] })).toBe(0);
    expect(topRank({ nodes: [{ id: 'a', type: 'service', title: 'a' }] })).toBe(1);
    expect(topRank({ nodes: [{ id: 'a', type: 'service', title: 'a', z: 9 }] })).toBe(10);
  });
});

describe('stacking ops (055)', () => {
  it('a new image takes the top rank, and a card added later lands above it', () => {
    const { doc, editor } = setupDeck();
    const [image = ''] = editor.addImages([newImage(1)]);
    expect(ids(doc)).toEqual(['a', 'b', 'c', `i:${image}`]);
    const card = editor.add('nodes', { type: 'service', title: 'D' });
    expect(ids(doc)).toEqual(['a', 'b', 'c', `i:${image}`, card]);
    expect(toJSON(doc).nodes.find((n) => n.id === card)?.z).toBe(4);
  });

  it('does not write z on a card added to a deck without images', () => {
    const { doc, editor } = setupDeck();
    editor.add('nodes', { type: 'service', title: 'D' });
    expect(toJSON(doc).nodes.some((n) => n.z !== undefined)).toBe(false);
  });

  it('bring to front and send to back write contiguous ranks in one undo step', () => {
    const { doc, editor } = setupDeck();
    const [i1 = '', i2 = ''] = editor.addImages([newImage(1), newImage(2)]);
    // a b c i1 i2
    editor.bringToFront({ nodes: ['a'], images: [i1] });
    expect(ids(doc)).toEqual(['b', 'c', `i:${i2}`, 'a', `i:${i1}`]);
    const ranks = stackOrder(toJSON(doc)).map((e) => e.rank);
    expect(ranks).toEqual([0, 1, 2, 3, 4]);
    editor.undo();
    expect(ids(doc)).toEqual(['a', 'b', 'c', `i:${i1}`, `i:${i2}`]);
    editor.sendToBack({ images: [i2], nodes: ['c'] });
    expect(ids(doc).slice(0, 2)).toEqual(['c', `i:${i2}`]);
    expectValid(doc);
  });

  it('keeps nodes in the order of the cards stacking', () => {
    const { doc, editor } = setupDeck();
    editor.addImages([newImage(1)]);
    editor.bringToFront({ nodes: ['a'] });
    expect(toJSON(doc).nodes.map((n) => n.id)).toEqual(['b', 'c', 'a']);
    editor.sendToBack({ nodes: ['c'] });
    expect(toJSON(doc).nodes.map((n) => n.id)).toEqual(['c', 'b', 'a']);
  });

  it('forward and backward step past the next unselected item, mixed selections included', () => {
    const { doc, editor } = setupDeck();
    const [i1 = ''] = editor.addImages([newImage(1)]);
    // a b c i1
    editor.bringForward({ nodes: ['b'] });
    expect(ids(doc)).toEqual(['a', 'c', 'b', `i:${i1}`]);
    editor.bringForward({ nodes: ['b'], images: [i1] });
    // b is below i1 (selected): only i1 has nothing above it, b stays under it.
    expect(ids(doc)).toEqual(['a', 'c', 'b', `i:${i1}`]);
    editor.sendBackward({ images: [i1], nodes: ['a'] });
    expect(ids(doc)).toEqual(['a', 'c', `i:${i1}`, 'b']);
    editor.sendBackward({ nodes: ['c'] });
    expect(ids(doc)).toEqual(['c', 'a', `i:${i1}`, 'b']);
  });

  it('writes no z in a deck without images, only the node order', () => {
    const { doc, editor } = setupDeck();
    editor.bringToFront({ nodes: ['a'] });
    expect(toJSON(doc).nodes.map((n) => n.id)).toEqual(['b', 'c', 'a']);
    expect(toJSON(doc).nodes.some((n) => n.z !== undefined)).toBe(false);
  });

  it('skips unknown ids and does nothing when nothing changes', () => {
    const { editor } = setupDeck();
    editor.bringToFront({ nodes: ['nope'], images: ['nope'] });
    editor.bringToFront({ nodes: ['c'] });
    expect(editor.canUndo()).toBe(false);
  });

  it('refuses a locked image, writing nothing', () => {
    const { doc, editor } = setupDeck();
    const [i1 = ''] = editor.addImages([newImage(1)]);
    editor.setLocked([i1], true, 'images');
    const before = ids(doc);
    expect(() => {
      editor.sendToBack({ images: [i1], nodes: ['a'] });
    }).toThrow(DeckEditError);
    expect(ids(doc)).toEqual(before);
  });

  it('deleting a card or an image renormalises nothing', () => {
    const { doc, editor } = setupDeck();
    const [i1 = ''] = editor.addImages([newImage(1)]);
    editor.bringToFront({ nodes: ['a'] });
    const ranks = () => stackOrder(toJSON(doc)).map((e) => `${e.id}:${String(e.rank)}`);
    const before = ranks();
    editor.remove('images', i1);
    expect(ranks()).toEqual(before.filter((r) => !r.startsWith(i1)));
  });
});

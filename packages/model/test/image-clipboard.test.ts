import { describe, expect, it } from 'vitest';

import {
  createEditor,
  fragmentOrigin,
  fromJSON,
  parseFragment,
  serializeFragment,
  stackOrder,
  toFragment,
  toJSON,
} from '../src';
import { expectValid, seqIds } from './helpers';
import { newImage, picture, setupDeck } from './image-helpers';

describe('copy and paste of images (055)', () => {
  it('copies images with cards, keeps asset ids and group relations, and pastes new ids on top', () => {
    const { doc, editor } = setupDeck({
      nodes: [
        { id: 'a', type: 'service', title: 'A', group: 'g', position: { x: 0, y: 0 } },
        { id: 'b', type: 'service', title: 'B', position: { x: 300, y: 0 } },
      ],
      groups: [
        { id: 'g', title: 'G', position: { x: -10, y: -10 }, size: { width: 400, height: 300 } },
      ],
    });
    const [inGroup = '', free = ''] = editor.addImages([
      newImage(1, { group: 'g', position: { x: 20, y: 20 } }),
      newImage(2, { position: { x: 50, y: 150 } }),
    ]);
    const edge = editor.add('edges', { from: 'a', to: inGroup });
    const file = toJSON(doc);
    const fragment = toFragment(file, {
      nodes: ['a'],
      groups: ['g'],
      images: [inGroup, free],
    });
    expect(fragment.images?.map((i) => i.id)).toEqual([inGroup, free]);
    expect(fragment.deck.edges.map((e) => e.id)).toEqual([edge]);
    expect(Object.keys(fragment.assets ?? {}).sort()).toEqual(
      [picture(1).id, picture(2).id].sort(),
    );

    const pasted = editor.pasteFragment(parseFragment(serializeFragment(fragment)) ?? fragment, {
      offset: { x: 500, y: 0 },
    });
    expect(pasted.images).toHaveLength(2);
    const out = toJSON(doc);
    const copies = out.images?.filter((i) => pasted.images.includes(i.id)) ?? [];
    expect(copies.map((i) => i.asset)).toEqual([picture(1).id, picture(2).id]);
    expect(copies[0]?.position).toEqual({ x: 520, y: 20 });
    // The copy in the group joins the pasted group, not the original one.
    expect(copies[0]?.group).toBe(pasted.groups[0]);
    expect(copies[1]).not.toHaveProperty('group');
    // New copies stack above everything that was there.
    const order = stackOrder(out).map((e) => e.id);
    const top = order.slice(-(pasted.images.length + pasted.nodes.length));
    expect(new Set(top)).toEqual(new Set([...pasted.images, ...pasted.nodes]));
    // The pasted connector ends on the pasted image.
    expect(out.edges.find((e) => e.id === pasted.edges[0])).toMatchObject({
      from: pasted.nodes[0],
      to: pasted.images[0],
    });
    // The picture facts are shared, not duplicated.
    expect(Object.keys(out.assets ?? {})).toHaveLength(2);
    expectValid(doc);
    editor.undo();
    expect(toJSON(doc).images).toHaveLength(2);
    expect(toJSON(doc).nodes).toHaveLength(2);
  });

  it('keeps pasted cards after the images in the stack when pasted into a deck that ranks', () => {
    const { doc, editor } = setupDeck();
    editor.addImages([newImage(1)]);
    const fragment = toFragment(toJSON(doc), { nodes: ['a'], groups: [], images: [] });
    editor.pasteFragment(fragment, { offset: { x: 5, y: 5 } });
    const order = stackOrder(toJSON(doc));
    expect(order[order.length - 1]?.kind).toBe('node');
    expect(order.length).toBe(5);
  });

  it('pastes into another deck: the records and facts are kept, the picture is just not there', () => {
    const source = setupDeck();
    const [id = ''] = source.editor.addImages([newImage(3)]);
    const fragment = toFragment(toJSON(source.doc), { nodes: [], groups: [], images: [id] });
    const target = createEditor(
      fromJSON({ ...toJSON(source.doc), images: undefined, assets: undefined }),
      {
        newId: seqIds(),
      },
    );
    target.pasteFragment(fragment, { offset: { x: 0, y: 0 } });
    const out = toJSON(target.doc);
    expect(out.images).toHaveLength(1);
    expect(out.assets?.[picture(3).id]).toMatchObject({ name: picture(3).meta.name, data: '' });
    expectValid(target.doc);
  });

  it('drops a group reference that leaves the fragment', () => {
    const { doc, editor } = setupDeck();
    const [id = ''] = editor.addImages([newImage(1, { group: 'g' })]);
    const fragment = toFragment(toJSON(doc), { nodes: [], groups: [], images: [id] });
    expect(fragment.images?.[0]).not.toHaveProperty('group');
  });

  it('counts images in the origin of a fragment', () => {
    const { doc, editor } = setupDeck();
    const [id = ''] = editor.addImages([newImage(1, { position: { x: -40, y: -70 } })]);
    const fragment = toFragment(toJSON(doc), { nodes: [], groups: [], images: [id] });
    expect(fragmentOrigin(fragment)).toEqual({ x: -40, y: -70 });
  });

  it('ignores malformed image keys in clipboard text', () => {
    const { doc, editor } = setupDeck();
    const [id = ''] = editor.addImages([newImage(1)]);
    const fragment = toFragment(toJSON(doc), { nodes: [], groups: [], images: [id] });
    const text = JSON.parse(serializeFragment(fragment)) as Record<string, unknown>;
    expect(parseFragment(JSON.stringify(text))).not.toBeNull();
    expect(parseFragment(JSON.stringify({ ...text, assets: {} }))).toBeNull();
    expect(parseFragment(JSON.stringify({ ...text, images: [{ id: 'x' }] }))).toBeNull();
    expect(parseFragment(JSON.stringify({ ...text, assets: undefined }))).toBeNull();
  });

  it('a fragment without images is unchanged and has no image keys', () => {
    const { doc } = setupDeck();
    const fragment = toFragment(toJSON(doc), { nodes: ['a'], groups: [] });
    expect(fragment).not.toHaveProperty('images');
    expect(fragment).not.toHaveProperty('assets');
    expect(serializeFragment(fragment)).not.toContain('"images"');
  });
});

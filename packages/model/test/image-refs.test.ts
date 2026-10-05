import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  checkDeck,
  checkIntegrity,
  DeckEditError,
  descendantImageIds,
  endpointOf,
  endpointTitle,
  fitGroupFrames,
  fromJSON,
  loadDeck,
  previewRemoval,
  toJSON,
} from '../src';
import { newImage, picture, setupDeck } from './image-helpers';

const p = picture(1);
const image = (id: string, extra: object = {}) => ({
  id,
  asset: p.id,
  position: { x: 0, y: 0 },
  size: { width: 40, height: 40 },
  ...extra,
});
function deck(patch: Partial<SododeckFile>): SododeckFile {
  return {
    ...emptySododeckFile(),
    assets: { [p.id]: { ...p.meta, data: p.data } },
    ...patch,
  };
}

describe('images as group members (055)', () => {
  const groups = [
    { id: 'outer', title: 'outer' },
    { id: 'inner', title: 'inner', parent: 'outer' },
  ];

  it('lists the images of a group and of nested groups', () => {
    const images = [image('i1', { group: 'inner' }), image('i2', { group: 'outer' }), image('i3')];
    expect(descendantImageIds({ images, groups }, 'outer').sort()).toEqual(['i1', 'i2']);
    expect(descendantImageIds({ images, groups }, 'inner')).toEqual(['i1']);
    expect(descendantImageIds({ groups }, 'outer')).toEqual([]);
    expect(descendantImageIds({ images, groups }, 'nope')).toEqual([]);
  });

  it('counts images in the fitted frame of their group', () => {
    const frames = fitGroupFrames(
      {
        nodes: [],
        views: [],
        groups: [{ id: 'g', title: 'g' }],
        images: [
          image('i', { group: 'g', position: { x: 100, y: 50 }, size: { width: 80, height: 40 } }),
        ],
      },
      { cardSize: { width: 10, height: 10 }, padding: 10 },
    );
    expect(frames.get('g')).toEqual({
      position: { x: 90, y: 40 },
      size: { width: 100, height: 60 },
    });
  });

  it('moves an image between groups as one undo step', () => {
    const { doc, editor } = setupDeck();
    const [id = ''] = editor.addImages([newImage(1, { group: 'g' })]);
    editor.setImageGroup(id, null);
    expect(toJSON(doc).images?.[0]).not.toHaveProperty('group');
    editor.undo();
    expect(toJSON(doc).images?.[0]?.group).toBe('g');
  });

  it('keeps an image when its group is deleted, moving it to the parent group', () => {
    const { doc, editor } = setupDeck({
      groups: [
        { id: 'g', title: 'G', parent: 'top' },
        { id: 'top', title: 'Top' },
      ],
    });
    const [id = ''] = editor.addImages([newImage(1, { group: 'g' })]);
    editor.remove('groups', 'g');
    expect(toJSON(doc).images?.[0]?.group).toBe('top');
    editor.remove('groups', 'top');
    expect(toJSON(doc).images?.[0]).not.toHaveProperty('group');
    expect(toJSON(doc).images?.[0]?.id).toBe(id);
    editor.undo();
    expect(toJSON(doc).images?.[0]?.group).toBe('top');
  });
});

describe('images as connector ends and in integrity (055)', () => {
  it('resolves an image end with its alt text, caption or "Image"', () => {
    const file = deck({
      images: [image('i1', { alt: 'Wireframe' }), image('i2', { caption: 'v2' }), image('i3')],
    });
    expect(endpointOf(file, 'i1')).toEqual({ kind: 'image', title: 'Wireframe' });
    expect(endpointTitle(file, 'i2')).toBe('v2');
    expect(endpointTitle(file, 'i3')).toBe('Image');
    expect(endpointOf(file, 'nope')).toBeNull();
  });

  it('accepts an edge with an image end through the editor and validate', () => {
    const { doc, editor } = setupDeck();
    const [id = ''] = editor.addImages([newImage(1)]);
    const edge = editor.add('edges', { from: 'a', to: id });
    expect(toJSON(doc).edges.find((e) => e.id === edge)?.to).toBe(id);
    expect(() => editor.add('edges', { from: 'a', to: 'img-missing' })).toThrow(DeckEditError);
    expect(checkIntegrity(toJSON(doc))).toEqual([]);
  });

  it('reports a missing image end, picture and group', () => {
    const problems = checkIntegrity(
      deck({
        nodes: [{ id: 'a', type: 'service', title: 'a' }],
        images: [image('i', { group: 'nope', asset: 'f'.repeat(64) })],
        edges: [{ id: 'e', from: 'a', to: 'gone' }],
      }),
    );
    expect(problems.map((x) => `${x.object.scope}.${x.field}:${x.targetType}`).sort()).toEqual([
      'edges.to:node',
      'images.asset:asset',
      'images.group:group',
    ]);
  });

  it('reports an image id that clashes with a card, a group or a note, in that order', () => {
    const file = deck({
      nodes: [{ id: 'n', type: 'service', title: 'n' }],
      groups: [{ id: 'g', title: 'g' }],
      stickies: [{ id: 's', text: 't', position: { x: 0, y: 0 } }],
      images: [image('n'), image('g'), image('s')],
    });
    const clashes = checkIntegrity(file).filter((x) => x.kind === 'duplicate-id');
    expect(clashes.map((x) => x.targetType)).toEqual(['node', 'group', 'sticky']);
    expect(clashes.every((x) => x.object.scope === 'images' && x.field === 'id')).toBe(true);
    expect(checkDeck(file).list.some((x) => x.kind === 'broken-reference')).toBe(true);
  });

  it('refuses at load an image whose id is a card, group or note id (rule I5), named or not', () => {
    const file = deck({
      nodes: [{ id: 'n', type: 'service', title: 'n' }],
      images: [image('n')],
      edges: [{ id: 'e', from: 'n', to: 'n' }],
    });
    expect(() => fromJSON(file)).toThrow(/already the id of a card, group or sticky/);
    expect(() => fromJSON({ ...file, edges: [] })).toThrow(/already the id/);
  });

  it('shows a picture missing from the file as a broken reference problem', () => {
    const file = deck({ images: [image('i', { alt: 'Hero', asset: 'e'.repeat(64) })] });
    const problems = checkDeck(file).list;
    expect(problems[0]?.detail).toBe('Image "Hero" uses a picture the deck does not hold');
  });
});

describe('deleting images (055)', () => {
  it('removes the connectors that end on an image, listing them in the preview, and undo restores both', () => {
    const { doc, editor } = setupDeck();
    const [id = ''] = editor.addImages([newImage(1)]);
    const e1 = editor.add('edges', { from: 'a', to: id });
    const e2 = editor.add('edges', { from: id, to: 'b' });
    const preview = previewRemoval(toJSON(doc), [{ scope: 'images', id }]);
    expect(preview.removed.map((r) => r.id)).toEqual([id, e1, e2]);
    const result = editor.remove('images', id);
    expect(result.removed.map((r) => r.id)).toEqual([id, e1, e2]);
    expect(toJSON(doc).edges).toEqual([]);
    expect(toJSON(doc).images).toBeUndefined();
    editor.undo();
    expect(toJSON(doc).images).toHaveLength(1);
    expect(toJSON(doc).edges.map((e) => e.id)).toEqual([e1, e2]);
    expect(Object.keys(toJSON(doc).assets ?? {})).toHaveLength(1);
  });

  it('refuses to delete a locked image, but a deleted card still takes its connector', () => {
    const { doc, editor } = setupDeck();
    const [id = ''] = editor.addImages([newImage(1)]);
    editor.add('edges', { from: 'a', to: id });
    editor.setLocked([id], true, 'images');
    expect(() => editor.remove('images', id)).toThrow(DeckEditError);
    editor.remove('nodes', 'a');
    expect(toJSON(doc).edges).toEqual([]);
  });

  it('leaves the picture facts in place when the last image is removed until the next save', () => {
    const { doc, editor } = setupDeck();
    const [id = ''] = editor.addImages([newImage(1)]);
    editor.remove('images', id);
    expect(doc.getMap('meta').has('assets')).toBe(true);
    expect(toJSON(doc)).not.toHaveProperty('assets');
  });
});

describe('loading with images (055)', () => {
  it('keeps a loaded image across loadDeck', () => {
    const { doc } = loadDeck(deck({ images: [image('i', { alt: 'x' })] }));
    expect(toJSON(doc).images?.[0]?.alt).toBe('x');
  });
});

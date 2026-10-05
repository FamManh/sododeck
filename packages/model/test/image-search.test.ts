import { describe, expect, it } from 'vitest';

import { buildSearchIndex, searchDeck, toJSON } from '../src';
import { newImage, setupDeck } from './image-helpers';

describe('search finds images (055)', () => {
  const setup = () => {
    const { doc, editor } = setupDeck();
    const [wire = '', plain = ''] = editor.addImages([
      newImage(1, { alt: 'Checkout wireframe', caption: 'Draft two' }),
      newImage(2),
    ]);
    return { index: buildSearchIndex(toJSON(doc)), wire, plain };
  };

  it('finds an image by alt text, caption and original file name', () => {
    const { index, wire, plain } = setup();
    expect(searchDeck(index, 'wireframe').results[0]).toMatchObject({
      kind: 'image',
      id: wire,
      title: 'Checkout wireframe',
      match: 'title',
    });
    const byCaption = searchDeck(index, 'draft two').results[0];
    expect(byCaption).toMatchObject({ kind: 'image', id: wire, match: 'body' });
    expect(byCaption?.snippet?.field).toBe('caption');
    const byFile = searchDeck(index, 'p2.png').results[0];
    expect(byFile).toMatchObject({ kind: 'image', id: plain, title: 'p2.png' });
    expect(byFile?.context).toBe('Image · p2.png');
  });

  it('titles an image without text by its file name', () => {
    const { index, plain } = setup();
    expect(index.entries.find((e) => e.id === plain)?.title).toBe('p2.png');
  });
});

import { describe, expect, it } from 'vitest';

import {
  DeckEditError,
  descendantImageIds,
  descendantNodeIds,
  getObject,
  isLocked,
  toJSON,
} from '../src';
import { expectValid } from './helpers';
import { newImage, setupDeck } from './image-helpers';

describe('lock over images (055)', () => {
  it('writes locked: true and removes the key on unlock, one undo step each', () => {
    const { doc, editor } = setupDeck();
    const [a = '', b = ''] = editor.addImages([newImage(1), newImage(2)]);
    editor.setLocked([a, b], true, 'images');
    expect(getObject(doc, 'images', a)?.locked).toBe(true);
    expect(getObject(doc, 'images', b)?.locked).toBe(true);
    editor.setLocked([a, b], false, 'images');
    expect(getObject(doc, 'images', a)).not.toHaveProperty('locked');
    editor.undo();
    expect(isLocked(getObject(doc, 'images', a) ?? {})).toBe(true);
    expectValid(doc);
  });

  it('refuses move, resize, delete, regroup and restack of a locked image, writing nothing', () => {
    const { doc, editor } = setupDeck();
    const [id = ''] = editor.addImages([newImage(1)]);
    editor.setLocked([id], true, 'images');
    const before = JSON.stringify(toJSON(doc));
    const attempts = [
      () => {
        editor.moveImage(id, { x: 1, y: 1 });
      },
      () => {
        editor.setImageSize(id, { width: 50, height: 50 });
      },
      () => {
        editor.remove('images', id);
      },
      () => {
        editor.setImageGroup(id, 'g');
      },
      () => {
        editor.bringToFront({ images: [id] });
      },
    ];
    for (const attempt of attempts) {
      expect(attempt).toThrow(DeckEditError);
      try {
        attempt();
      } catch (error) {
        expect((error as DeckEditError).code).toBe('locked');
      }
    }
    expect(JSON.stringify(toJSON(doc))).toBe(before);
  });

  it('keeps alt text and caption editable on a locked image, and unlock always works', () => {
    const { doc, editor } = setupDeck();
    const [id = ''] = editor.addImages([newImage(1)]);
    editor.setLocked([id], true, 'images');
    editor.setImageText(id, { alt: 'ok' });
    expect(getObject(doc, 'images', id)?.alt).toBe('ok');
    editor.setLocked([id], false, 'images');
    editor.moveImage(id, { x: 3, y: 3 });
    expect(getObject(doc, 'images', id)?.position).toEqual({ x: 3, y: 3 });
  });

  it('ignores unknown ids and writes nothing when nothing changes', () => {
    const { editor } = setupDeck();
    editor.setLocked(['nope'], true, 'images');
    expect(editor.canUndo()).toBe(false);
  });

  it('locks every card and image of a group in one undo step, and unlocks them', () => {
    const { doc, editor } = setupDeck({
      nodes: [
        { id: 'a', type: 'service', title: 'A', group: 'g' },
        { id: 'b', type: 'service', title: 'B' },
      ],
    });
    const [inside = '', outside = ''] = editor.addImages([
      newImage(1, { group: 'g' }),
      newImage(2),
    ]);
    const file = toJSON(doc);
    const lockGroup = (locked: boolean) => {
      editor.batch(() => {
        editor.setLocked(descendantNodeIds(file, 'g'), locked);
        editor.setLocked(descendantImageIds(file, 'g'), locked, 'images');
      });
    };
    lockGroup(true);
    expect(getObject(doc, 'nodes', 'a')?.locked).toBe(true);
    expect(getObject(doc, 'images', inside)?.locked).toBe(true);
    expect(getObject(doc, 'images', outside)).not.toHaveProperty('locked');
    expect(getObject(doc, 'nodes', 'b')).not.toHaveProperty('locked');
    editor.undo();
    expect(getObject(doc, 'nodes', 'a')).not.toHaveProperty('locked');
    expect(getObject(doc, 'images', inside)).not.toHaveProperty('locked');
    editor.redo();
    lockGroup(false);
    expect(getObject(doc, 'images', inside)).not.toHaveProperty('locked');
  });
});

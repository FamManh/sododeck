import { createEditor, fromJSON, toJSON } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { commitTitle, nextTitleTarget, readingOrder } from './title-edit';

const file = (): SododeckFile => ({
  ...emptySododeckFile(),
  nodes: [
    { id: 'n1', type: 'service', title: 'Service 3', position: { x: 300, y: 0 } },
    { id: 'n2', type: 'database', title: 'Orders DB', position: { x: 0, y: 0 } },
    { id: 'n3', type: 'queue', title: 'Queue', position: { x: 0, y: 200 } },
  ],
  groups: [{ id: 'g1', title: 'Payments' }],
});

const setup = () => {
  const doc = fromJSON(file());
  return { doc, editor: createEditor(doc) };
};

const titleOf = (doc: ReturnType<typeof fromJSON>, id: string) =>
  toJSON(doc).nodes.find((n) => n.id === id)?.title;

describe('commitTitle', () => {
  it('trims and writes the title as one undo step', () => {
    const { doc, editor } = setup();
    expect(commitTitle(editor, 'node', 'n1', '  Billing API ', 'Service 3')).toBe('renamed');
    expect(titleOf(doc, 'n1')).toBe('Billing API');
    editor.undo();
    expect(titleOf(doc, 'n1')).toBe('Service 3');
    expect(editor.undo()).toBe(false);
  });

  it('writes nothing for an empty or unchanged title (FR-005)', () => {
    const { doc, editor } = setup();
    expect(commitTitle(editor, 'node', 'n1', '   ', 'Service 3')).toBe('unchanged');
    expect(commitTitle(editor, 'node', 'n1', 'Service 3 ', 'Service 3')).toBe('unchanged');
    expect(titleOf(doc, 'n1')).toBe('Service 3');
    expect(editor.undo()).toBe(false);
  });

  it('renames a group', () => {
    const { doc, editor } = setup();
    expect(commitTitle(editor, 'group', 'g1', 'Billing', 'Payments')).toBe('renamed');
    expect(toJSON(doc).groups[0]?.title).toBe('Billing');
  });

  it('writes nothing when the object is gone', () => {
    const { editor } = setup();
    expect(commitTitle(editor, 'node', 'missing', 'X', 'Y')).toBe('unchanged');
    expect(editor.undo()).toBe(false);
  });
});

describe('readingOrder / nextTitleTarget', () => {
  it('reads top to bottom, then left to right', () => {
    expect(readingOrder(file(), ['n1', 'n2', 'n3'])).toEqual(['n2', 'n1', 'n3']);
    expect(readingOrder(file(), ['n3', 'n1'])).toEqual(['n1', 'n3']);
  });

  it('moves forward and back without wrapping', () => {
    const order = ['n2', 'n1', 'n3'];
    expect(nextTitleTarget(order, 'n2', 1)).toBe('n1');
    expect(nextTitleTarget(order, 'n1', -1)).toBe('n2');
    expect(nextTitleTarget(order, 'n3', 1)).toBeNull();
    expect(nextTitleTarget(order, 'n2', -1)).toBeNull();
    expect(nextTitleTarget(order, 'gone', 1)).toBeNull();
  });
});

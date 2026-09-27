import { describe, expect, it } from 'vitest';

import { gridKey } from './use-grid-keys';

const key = (
  k: string,
  mods: Partial<{ altKey: boolean; metaKey: boolean; ctrlKey: boolean }> = {},
) => ({
  key: k,
  altKey: false,
  metaKey: false,
  ctrlKey: false,
  ...mods,
});

describe('gridKey (research R9)', () => {
  it('moves with the arrows, Home and End, clamped to the grid', () => {
    const at = { row: 1, col: 0 };
    expect(gridKey(key('ArrowUp'), at, 3, 4)).toEqual({ kind: 'move', to: { row: 0, col: 0 } });
    expect(gridKey(key('ArrowDown'), { row: 2, col: 0 }, 3, 4)).toEqual({
      kind: 'move',
      to: { row: 2, col: 0 },
    });
    expect(gridKey(key('ArrowLeft'), at, 3, 4)).toEqual({ kind: 'move', to: { row: 1, col: -1 } });
    expect(gridKey(key('ArrowLeft'), { row: 1, col: -1 }, 3, 4)).toEqual({
      kind: 'move',
      to: { row: 1, col: -1 },
    });
    expect(gridKey(key('End'), at, 3, 4)).toEqual({ kind: 'move', to: { row: 1, col: 3 } });
    expect(gridKey(key('Home'), at, 3, 4)).toEqual({ kind: 'move', to: { row: 1, col: -1 } });
  });

  it('edits a cell with Enter, F2 or a typed character, never on the row header', () => {
    expect(gridKey(key('Enter'), { row: 0, col: 1 }, 3, 4)).toEqual({ kind: 'edit' });
    expect(gridKey(key('F2'), { row: 0, col: 1 }, 3, 4)).toEqual({ kind: 'edit' });
    expect(gridKey(key('>'), { row: 0, col: 1 }, 3, 4)).toEqual({ kind: 'edit', text: '>' });
    expect(gridKey(key('Enter'), { row: 0, col: -1 }, 3, 4)).toBeNull();
    expect(gridKey(key('x'), { row: 0, col: -1 }, 3, 4)).toBeNull();
  });

  it('deletes a row with ⌫ or Delete on its header only, and ignores modified keys', () => {
    expect(gridKey(key('Backspace'), { row: 0, col: -1 }, 3, 4)).toEqual({ kind: 'delete-row' });
    expect(gridKey(key('Delete'), { row: 0, col: -1 }, 3, 4)).toEqual({ kind: 'delete-row' });
    expect(gridKey(key('Backspace'), { row: 0, col: 0 }, 3, 4)).toBeNull();
    expect(gridKey(key('ArrowUp', { altKey: true }), { row: 1, col: 0 }, 3, 4)).toBeNull();
    expect(gridKey(key('z', { metaKey: true }), { row: 1, col: 0 }, 3, 4)).toBeNull();
  });
});

/**
 * Keyboard map of the decision table (ARIA grid, research R9). Pure: turns a key on the focused
 * position into an action. Column -1 is the row header (number, grip, delete).
 */
export interface GridPos {
  row: number;
  col: number;
}

export type GridAction =
  { kind: 'move'; to: GridPos } | { kind: 'edit'; text?: string } | { kind: 'delete-row' } | null;

interface KeyLike {
  key: string;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}

export function gridKey(event: KeyLike, pos: GridPos, rows: number, cols: number): GridAction {
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  const clampRow = (r: number) => Math.max(0, Math.min(rows - 1, r));
  const clampCol = (c: number) => Math.max(-1, Math.min(cols - 1, c));
  switch (event.key) {
    case 'ArrowUp':
      return { kind: 'move', to: { row: clampRow(pos.row - 1), col: pos.col } };
    case 'ArrowDown':
      return { kind: 'move', to: { row: clampRow(pos.row + 1), col: pos.col } };
    case 'ArrowLeft':
      return { kind: 'move', to: { row: pos.row, col: clampCol(pos.col - 1) } };
    case 'ArrowRight':
      return { kind: 'move', to: { row: pos.row, col: clampCol(pos.col + 1) } };
    case 'Home':
      return { kind: 'move', to: { row: pos.row, col: -1 } };
    case 'End':
      return { kind: 'move', to: { row: pos.row, col: cols - 1 } };
    case 'Enter':
    case 'F2':
      return pos.col >= 0 ? { kind: 'edit' } : null;
    case 'Backspace':
    case 'Delete':
      return pos.col === -1 ? { kind: 'delete-row' } : null;
    default:
      // Typing a character starts editing with it (spreadsheet behavior).
      return pos.col >= 0 && event.key.length === 1 ? { kind: 'edit', text: event.key } : null;
  }
}

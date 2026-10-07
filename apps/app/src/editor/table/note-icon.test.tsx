import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { NoteIcon } from './note-icon';

const initial = useUiStore.getState();
const target = { kind: 'column' as const, nodeId: 'users', columnId: 'email' };

describe('NoteIcon (064 FR-009a)', () => {
  beforeEach(() => {
    useUiStore.setState(initial, true);
  });

  it('toggles the popover on click, at once', () => {
    render(<NoteIcon target={target} name="email" size={12} />);
    const button = screen.getByRole('button', { name: 'Show note for email' });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(useUiStore.getState().dbPopover).toEqual({ ...target, source: 'click' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(button);
    expect(useUiStore.getState().dbPopover).toBeNull();
  });

  it('turns a hover popover on the same target into a click one', () => {
    useUiStore.getState().openDbPopover({ ...target, source: 'hover' });
    render(<NoteIcon target={target} name="email" size={12} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show note for email' }));
    expect(useUiStore.getState().dbPopover?.source).toBe('click');
  });

  it('never lets a press reach the row or the card (no select, no drag)', () => {
    const rowDown = vi.fn();
    const rowClick = vi.fn();
    render(
      <div onPointerDown={rowDown} onMouseDown={rowDown} onClick={rowClick}>
        <NoteIcon target={target} name="email" size={12} />
      </div>,
    );
    const button = screen.getByRole('button', { name: 'Show note for email' });
    fireEvent.pointerDown(button);
    fireEvent.mouseDown(button);
    fireEvent.click(button);
    expect(rowDown).not.toHaveBeenCalled();
    expect(rowClick).not.toHaveBeenCalled();
  });
});

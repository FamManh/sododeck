import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { JsonResizeHandle } from './json-resize-handle';

function setup(height = 212, available = 900) {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  render(
    <JsonResizeHandle
      height={height}
      available={available}
      onChange={onChange}
      onCommit={onCommit}
    />,
  );
  const handle = screen.getByRole('separator', { name: 'Resize JSON panel' });
  return { handle, onChange, onCommit, user: userEvent.setup() };
}

describe('JsonResizeHandle', () => {
  it('is a focusable horizontal separator with its limits', async () => {
    const { handle, user } = setup(212, 900);
    expect(handle).toHaveAttribute('aria-orientation', 'horizontal');
    expect(handle).toHaveAttribute('aria-valuenow', '212');
    expect(handle).toHaveAttribute('aria-valuemin', '96');
    expect(handle).toHaveAttribute('aria-valuemax', '700');
    await user.tab();
    expect(handle).toHaveFocus();
  });

  it.each([
    ['{ArrowUp}', 228],
    ['{ArrowDown}', 196],
    ['{Home}', 96],
    ['{End}', 700],
  ])('%s changes and commits the height', async (key, expected) => {
    const { handle, onChange, onCommit, user } = setup(212, 900);
    handle.focus();
    await user.keyboard(key);
    expect(onChange).toHaveBeenLastCalledWith(expected);
    expect(onCommit).toHaveBeenLastCalledWith(expected);
  });

  it('clamps key steps to the limits', async () => {
    const { handle, onCommit, user } = setup(100, 900);
    handle.focus();
    await user.keyboard('{ArrowDown}');
    expect(onCommit).toHaveBeenLastCalledWith(96);
  });

  it('follows a pointer drag and commits once on release', () => {
    const { handle, onChange, onCommit } = setup(212, 900);
    fireEvent.pointerDown(handle, { clientY: 500, pointerId: 1, button: 0 });
    fireEvent.pointerMove(handle, { clientY: 480, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 450, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(262);
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(handle, { clientY: 450, pointerId: 1 });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(262);
  });
});

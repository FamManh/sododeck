import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { useSortableList } from './use-sortable-list';

const initial = useUiStore.getState();

/** jsdom has no layout: the row "under the pointer" is set by hand. */
function pointAt(element: Element): void {
  document.elementFromPoint = () => element;
}

function List({
  ids,
  onMove,
  locked,
  group = 'g',
}: {
  ids: string[];
  onMove: (id: string, position: number) => void;
  locked?: (id: string) => boolean;
  group?: string;
}) {
  const { rowProps, gripProps, drag } = useSortableList({ ids, group, onMove, locked });
  return (
    <ul>
      {ids.map((id) => (
        <li key={id} tabIndex={0} aria-label={id} {...rowProps(id)}>
          <span data-testid={`grip-${id}`} {...gripProps(id)} />
          {drag?.id === id && <span>dragging to {String(drag.over)}</span>}
        </li>
      ))}
    </ul>
  );
}

describe('useSortableList', () => {
  beforeEach(() => {
    useUiStore.setState(initial, true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('moves with ⌥↑ / ⌥↓, stops at the bounds and announces the position', () => {
    const onMove = vi.fn();
    render(<List ids={['a', 'b', 'c']} onMove={onMove} />);
    fireEvent.keyDown(screen.getByLabelText('c'), { key: 'ArrowUp', altKey: true });
    expect(onMove).toHaveBeenLastCalledWith('c', 1);
    expect(useUiStore.getState().announcement.text).toBe('Moved to position 2 of 3');
    fireEvent.keyDown(screen.getByLabelText('a'), { key: 'ArrowUp', altKey: true });
    fireEvent.keyDown(screen.getByLabelText('c'), { key: 'ArrowDown', altKey: true });
    fireEvent.keyDown(screen.getByLabelText('b'), { key: 'ArrowDown' });
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('never moves a locked row, nor anything past it', () => {
    const onMove = vi.fn();
    render(<List ids={['a', 'b', 'c']} onMove={onMove} locked={(id) => id === 'c'} />);
    fireEvent.keyDown(screen.getByLabelText('c'), { key: 'ArrowUp', altKey: true });
    fireEvent.keyDown(screen.getByLabelText('b'), { key: 'ArrowDown', altKey: true });
    expect(onMove).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByLabelText('b'), { key: 'ArrowUp', altKey: true });
    expect(onMove).toHaveBeenCalledWith('b', 0);
  });

  it('reorders by dragging the grip within the group', () => {
    const onMove = vi.fn();
    render(<List ids={['a', 'b', 'c']} onMove={onMove} />);
    pointAt(screen.getByLabelText('a'));
    const grip = screen.getByTestId('grip-c');
    fireEvent.pointerDown(grip, { button: 0, pointerId: 1 });
    fireEvent.pointerMove(grip, { clientX: 5, clientY: 5, pointerId: 1 });
    expect(screen.getByText('dragging to 0')).toBeInTheDocument();
    fireEvent.pointerUp(grip, { pointerId: 1 });
    expect(onMove).toHaveBeenCalledWith('c', 0);
  });

  it('refuses a drop outside the group, and Esc cancels a drag', () => {
    const onMove = vi.fn();
    render(
      <>
        <List ids={['a', 'b']} onMove={onMove} />
        <List ids={['x']} onMove={onMove} group="other" />
      </>,
    );
    pointAt(screen.getByLabelText('x'));
    const grip = screen.getByTestId('grip-b');
    fireEvent.pointerDown(grip, { button: 0, pointerId: 1 });
    fireEvent.pointerMove(grip, { clientX: 5, clientY: 5, pointerId: 1 });
    fireEvent.pointerUp(grip, { pointerId: 1 });
    expect(onMove).not.toHaveBeenCalled();

    pointAt(screen.getByLabelText('a'));
    fireEvent.pointerDown(grip, { button: 0, pointerId: 1 });
    fireEvent.pointerMove(grip, { clientX: 5, clientY: 5, pointerId: 1 });
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(screen.queryByText(/dragging/)).not.toBeInTheDocument();
    fireEvent.pointerUp(grip, { pointerId: 1 });
    expect(onMove).not.toHaveBeenCalled();
  });
});

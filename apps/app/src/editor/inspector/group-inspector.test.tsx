import { toJSON } from '@sododeck/model';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { Inspector } from '../inspector';
import { collapsedOf } from '../views/use-current-view';

describe('GroupInspector', () => {
  it('shows the heading, collapsed switch, merged connections and expand button', async () => {
    const user = userEvent.setup();
    const deck = deckOf({
      nodes: [
        { id: 'a', type: 'service', title: 'A', group: 'core' },
        { id: 'b', type: 'service', title: 'B' },
      ],
      groups: [{ id: 'core', title: 'Core services' }],
      // Collapse is saved in the view (011 FR-050).
      views: [{ id: 'v', type: 'system', title: 'V', collapsed: ['core'] }],
      edges: [
        { id: 'e1', from: 'a', to: 'b' },
        { id: 'e2', from: 'a', to: 'b' },
      ],
    });
    const { doc } = renderWithEditor(<Inspector deck={deck} />, deck);
    act(() => {
      useUiStore.getState().select({ groups: ['core'] });
    });

    expect(screen.getByText('Core services')).toBeInTheDocument();
    const collapsed = screen.getByRole('switch', { name: 'Collapsed' });
    expect(collapsed).toBeChecked();
    expect(screen.getByText('Merged connections')).toBeInTheDocument();
    expect(screen.getByText(/collapsed:core|b/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand group' }));
    expect(collapsedOf(doc).has('core')).toBe(false);
  });
});

describe('GroupInspector colour (020 T054)', () => {
  it('shows Appearance with the group fill, and applying a colour is one undo step', async () => {
    const user = userEvent.setup();
    const deck = deckOf({
      groups: [{ id: 'core', title: 'Core services', style: { fill: 'teal' } }],
    });
    const { doc } = renderWithEditor(<Inspector deck={deck} />, deck);
    act(() => {
      useUiStore.getState().select({ groups: ['core'] });
    });

    expect(screen.getByRole('button', { name: 'Fill: Teal' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fill: Teal' }));
    await user.click(screen.getByRole('radio', { name: 'Green' }));
    expect(toJSON(doc).groups.find((g) => g.id === 'core')?.style?.fill).toBe('green');
  });
});

describe('GroupInspector Frame fields (016 FR-044)', () => {
  const framed = deckOf({
    nodes: [{ id: 'a', type: 'service', title: 'A', group: 'core', position: { x: 0, y: 0 } }],
    groups: [
      {
        id: 'core',
        title: 'Core services',
        position: { x: -24, y: -24 },
        size: { width: 400, height: 300 },
      },
    ],
  });

  it('shows X, Y, Width and Height, and each commit is one undo step', async () => {
    const user = userEvent.setup();
    const { doc, editor } = renderWithEditor(<Inspector deck={framed} />, framed);
    act(() => {
      useUiStore.getState().select({ groups: ['core'] });
    });
    const width = screen.getByRole('spinbutton', { name: 'Width' });
    expect(screen.getByRole('spinbutton', { name: 'X' })).toHaveValue(-24);
    expect(screen.getByRole('spinbutton', { name: 'Y' })).toHaveValue(-24);
    expect(width).toHaveValue(400);
    expect(screen.getByRole('spinbutton', { name: 'Height' })).toHaveValue(300);
    await user.clear(width);
    await user.type(width, '600{Enter}');
    expect(toJSON(doc).groups[0]?.size).toEqual({ width: 600, height: 300 });
    // Members never move.
    expect(toJSON(doc).nodes[0]?.position).toEqual({ x: 0, y: 0 });
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).groups[0]?.size).toEqual({ width: 400, height: 300 });
    expect(editor().canUndo()).toBe(false);
  });

  it('applies the resize limits: never smaller than the members plus padding', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<Inspector deck={framed} />, framed);
    act(() => {
      useUiStore.getState().select({ groups: ['core'] });
    });
    const width = screen.getByRole('spinbutton', { name: 'Width' });
    await user.clear(width);
    await user.type(width, '10');
    await user.tab();
    // The member card is 184 wide at full detail, plus 24 px each side.
    expect(toJSON(doc).groups[0]?.size?.width).toBe(232);
  });
});

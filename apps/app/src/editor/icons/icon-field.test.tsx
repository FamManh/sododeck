import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { IconField } from './icon-field';

const cards = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A', icon: 'lucide:server' },
    { id: 'b', type: 'service', title: 'B', icon: 'lucide:database' },
    { id: 'c', type: 'queue', title: 'C' },
    { id: 'd', type: 'service', title: 'D', icon: 'simple:kafka' },
    { id: 'e', type: 'service', title: 'E', icon: 'lucide:server' },
    { id: 'shape', type: 'rectangle', title: 'Shape', icon: 'mdi:database' },
  ],
  edges: [{ id: 'x', from: 'a', to: 'b' }],
  stickies: [{ id: 's', text: 'note', position: { x: 0, y: 0 } }],
});

function setup(nodes: string[], extra: { edges?: string[]; stickies?: string[] } = {}) {
  const env = renderWithEditor(
    <IconField
      selection={{ nodes, edges: extra.edges ?? [], groups: [], stickies: extra.stickies ?? [] }}
      onDone={() => undefined}
    />,
    cards,
  );
  return { ...env, user: userEvent.setup() };
}

const iconsOf = (doc: Parameters<typeof toJSON>[0]) =>
  Object.fromEntries(toJSON(doc).nodes.map((n) => [n.id, n.icon]));

describe('IconField (038 T029)', () => {
  it('writes a pick to every selected card as one undo step', async () => {
    const { user, doc, editor } = setup(['a', 'b', 'c', 'd', 'e']);
    expect(screen.getByText('Mixed')).toBeInTheDocument();
    expect(screen.queryAllByRole('gridcell', { selected: true })).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Zap' }));
    expect(iconsOf(doc)).toMatchObject({
      a: 'lucide:zap',
      b: 'lucide:zap',
      c: 'lucide:zap',
      d: 'lucide:zap',
      e: 'lucide:zap',
    });
    act(() => {
      editor().undo();
    });
    expect(iconsOf(doc)).toMatchObject({
      a: 'lucide:server',
      b: 'lucide:database',
      c: undefined,
      d: 'simple:kafka',
      e: 'lucide:server',
    });
  });

  it('selects the shared icon when every card agrees', () => {
    setup(['a', 'e']);
    const selected = screen.getAllByRole('gridcell', { selected: true });
    expect(selected).toHaveLength(1);
    expect(
      within(selected[0] as HTMLElement).getByRole('button', { name: 'Server' }),
    ).toBeVisible();
    expect(screen.getByText('Changes 2 cards')).toBeInTheDocument();
  });

  it('counts only cards and leaves shapes and other items alone', async () => {
    const { user, doc } = setup(['a', 'shape'], { edges: ['x'], stickies: ['s'] });
    expect(screen.getByText('Changes 1 card')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zap' }));
    expect(iconsOf(doc)).toMatchObject({ a: 'lucide:zap', shape: 'mdi:database' });
  });

  it('shows no scope line for one card alone', () => {
    setup(['a']);
    expect(screen.queryByText(/^Changes /)).not.toBeInTheDocument();
  });

  it('resets every card to its type icon, disabled when none has an icon', async () => {
    const { user, doc } = setup(['a', 'b']);
    await user.click(screen.getByRole('button', { name: 'Reset to type icon' }));
    expect(iconsOf(doc)).toMatchObject({ a: undefined, b: undefined, shape: 'mdi:database' });
  });

  it('disables Reset when no selected card has an icon', () => {
    setup(['c']);
    expect(screen.getByRole('button', { name: 'Reset to type icon' })).toBeDisabled();
  });
});

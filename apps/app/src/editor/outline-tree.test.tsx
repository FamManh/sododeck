import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useEditor } from '../model/use-editor';
import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useUiStore } from '../state/ui-store';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import { OutlineTree } from './outline-tree';

const deck = deckOf({
  nodes: [
    { id: 'svc', type: 'service', title: 'Order Service', group: 'core' },
    { id: 'db', type: 'database', title: 'Orders DB', group: 'core' },
    { id: 'web', type: 'client', title: 'Web' },
  ],
  groups: [{ id: 'core', title: 'Core services' }],
});

function Harness() {
  const editor = useEditor();
  return <OutlineTree deck={useDeckSnapshot(editor.doc)} />;
}

const setup = () => ({ ...renderWithEditor(<Harness />, deck), user: userEvent.setup() });
const names = () => screen.getAllByRole('treeitem').map((i) => i.textContent);

describe('OutlineTree icons (038)', () => {
  it("draws a node's own icon in its tile", () => {
    renderWithEditor(
      <OutlineTree
        deck={deckOf({
          nodes: [
            { id: 'a', type: 'service', title: 'Has icon', icon: 'lucide:search' },
            { id: 'b', type: 'service', title: 'No icon' },
          ],
        })}
      />,
      deck,
    );
    const [first, second] = screen.getAllByRole('treeitem');
    expect(first?.querySelector('[data-icon="lucide:search"]')).not.toBeNull();
    expect(second?.querySelector('[data-icon="lucide:search"]')).toBeNull();
    expect(second?.querySelector('svg.lucide-box')).not.toBeNull();
  });
});

describe('OutlineTree', () => {
  it('lists groups with counts and components under them', () => {
    setup();
    expect(screen.getByRole('tree', { name: 'Components' })).toBeInTheDocument();
    expect(names()).toEqual(['Core services2', 'Order Service', 'Orders DB', 'Web']);
    expect(screen.getByRole('treeitem', { name: /Core services/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('collapses and expands a group by click and by arrow keys', async () => {
    const { user } = setup();
    const group = screen.getByRole('treeitem', { name: /Core services/ });
    await user.click(group);
    expect(group).toHaveAttribute('aria-expanded', 'false');
    expect(names()).toEqual(['Core services2', 'Web']);
    await user.keyboard('{ArrowRight}');
    expect(names()).toHaveLength(4);
    await user.keyboard('{ArrowLeft}');
    expect(names()).toHaveLength(2);
  });

  it('moves with the arrows and selects a component with Enter', async () => {
    const { user } = setup();
    screen.getByRole('treeitem', { name: /Core services/ }).focus();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('treeitem', { name: 'Orders DB' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(useUiStore.getState().selection.nodes).toEqual(['db']);
    expect(useUiStore.getState().focusedId).toBe('db');
    expect(screen.getByRole('treeitem', { name: 'Orders DB' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('treeitem', { name: /Core services/ })).toHaveFocus();
  });

  it('selects a component on click', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('treeitem', { name: 'Web' }));
    expect(useUiStore.getState().selection.nodes).toEqual(['web']);
  });

  it('prepends an up row while drilled and clicking it goes up one level', async () => {
    const { user } = setup();
    act(() => {
      useUiStore.setState({
        drill: [{ kind: 'group', id: 'core', viewport: { x: 0, y: 0, zoom: 1 } }],
      });
    });
    const up = screen.getByRole('treeitem', { name: 'Up to System view' });
    expect(names()).toEqual(['Up to System view', 'Order Service', 'Orders DB']);
    await user.click(up);
    expect(useUiStore.getState().drill).toEqual([]);
  });
});

describe('OutlineTree colour (020 T055)', () => {
  it("extends the row's accessible description with the colour", () => {
    const coloured = deckOf({
      nodes: [
        { id: 'a', type: 'service', title: 'A', group: 'core' },
        { id: 'web', type: 'client', title: 'Web', style: { fill: 'green' } },
      ],
      groups: [{ id: 'core', title: 'Core services', style: { stroke: 'red' } }],
    });
    renderWithEditor(<OutlineTree deck={coloured} />, coloured);
    expect(screen.getByRole('treeitem', { name: 'Web' })).toHaveAttribute(
      'aria-description',
      expect.stringContaining('Green fill'),
    );
    expect(screen.getByRole('treeitem', { name: /Core services/ })).toHaveAttribute(
      'aria-description',
      expect.stringContaining('Red stroke'),
    );
  });
});

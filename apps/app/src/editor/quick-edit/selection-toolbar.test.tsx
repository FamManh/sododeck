import { toJSON } from '@sododeck/model';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { Canvas } from '../canvas';
import { DetailDrawer } from '../shell/detail-drawer';
import { useEditorShortcuts } from '../use-canvas-shortcuts';
import { SelectionToolbar } from './selection-toolbar';

const deck = deckOf({
  nodes: [
    {
      id: 'a',
      type: 'service',
      title: 'Order Service',
      owner: 'Checkout',
      tags: ['pci'],
      position: { x: 0, y: 0 },
    },
    {
      id: 'b',
      type: 'database',
      title: 'Orders DB',
      owner: 'Payments team',
      position: { x: 300, y: 0 },
    },
    {
      id: 'c',
      type: 'queue',
      title: 'Bus',
      owner: 'Payments team',
      tags: ['pci'],
      position: { x: 0, y: 200 },
    },
  ],
  edges: [{ id: 'e', from: 'a', to: 'b', label: 'writes' }],
  groups: [],
});

const ui = () => useUiStore.getState();

function Harness() {
  useEditorShortcuts();
  const file = useDeckSnapshot(useEditor().doc);
  return (
    <>
      <Canvas />
      <SelectionToolbar />
      <DetailDrawer deck={file} />
    </>
  );
}

function setup() {
  const env = renderWithEditor(<Harness />, deck);
  return { ...env, user: userEvent.setup() };
}

const select = (nodes: string[]) => {
  act(() => {
    ui().select({ nodes });
  });
};
const toolbar = () => screen.queryByRole('toolbar', { name: /^Selection:/ });
const names = () =>
  within(screen.getByRole('toolbar'))
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label'));

describe('SelectionToolbar (019 US3)', () => {
  it('shows nothing without a selection, then one toolbar named after the component', () => {
    setup();
    expect(toolbar()).toBeNull();
    select(['a']);
    expect(screen.getByRole('toolbar', { name: 'Selection: Order Service' })).toHaveAttribute(
      'aria-orientation',
      'horizontal',
    );
    expect(names()).toEqual([
      'Open details',
      'Kind: Service',
      'Owner: Checkout',
      'Tags',
      'Technology: none',
      'Links',
      'Rules',
      'Colour: none',
      'More actions',
    ]);
    expect(screen.getByRole('button', { name: 'Owner: Checkout' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    );
    expect(screen.getByRole('button', { name: 'More actions' })).toHaveAttribute(
      'aria-haspopup',
      'menu',
    );
  });

  it('shows the fill as a mini swatch on the Colour button (020 T032)', () => {
    const env = setup();
    select(['a']);
    act(() => {
      env.editor().setStyle({ nodes: ['a'], groups: [] }, 'fill', 'green');
    });
    const button = screen.getByRole('button', { name: 'Colour: Green' });
    const swatch = button.querySelector('[data-slot="swatch"]');
    expect(swatch).toHaveStyle({ '--swatch': 'var(--color-card-green-fill)' });
  });

  it('opens the Colour popover and writes the pick through the editor (020 T032)', async () => {
    const { user, doc } = setup();
    select(['a']);
    await user.click(screen.getByRole('button', { name: 'Colour: none' }));
    const dialog = await screen.findByRole('dialog', { name: 'Colour' });
    await user.click(within(dialog).getByRole('radio', { name: 'Blue' }));
    const node = toJSON(doc).nodes.find((n) => n.id === 'a');
    expect(node?.style).toEqual({ fill: 'blue' });
    expect(screen.getByRole('button', { name: 'Colour: Blue' })).toBeInTheDocument();
  });

  it("shows the group toolbar's Colour button after Collapse (020 T054)", () => {
    const groupDeck = deckOf({
      nodes: [{ id: 'a', type: 'service', title: 'A', group: 'core' }],
      groups: [{ id: 'core', title: 'Core services' }],
    });
    renderWithEditor(<Harness />, groupDeck);
    act(() => {
      ui().select({ groups: ['core'] });
    });
    const labels = names();
    const collapseIndex = labels.indexOf('Collapse');
    const colourIndex = labels.findIndex((label) => label?.startsWith('Colour:'));
    expect(collapseIndex).toBeGreaterThanOrEqual(0);
    expect(colourIndex).toBeGreaterThan(collapseIndex);
  });

  it('shows the count and the shared fields for several components, "Mixed" when they differ', () => {
    setup();
    select(['a', 'b', 'c']);
    const bar = screen.getByRole('toolbar', { name: 'Selection: 3 components' });
    expect(within(bar).getByText('3 selected')).toBeInTheDocument();
    expect(names()).toEqual([
      'Kind: Mixed',
      'Owner: Mixed',
      'Tags',
      'Technology: none',
      'Colour: none',
      'Group',
      'Align',
      'More actions',
    ]);
  });

  it('hides during a gesture, a title edit, flow mode and Hide UI, then comes back', () => {
    setup();
    select(['a']);
    act(() => {
      ui().setCanvasGesture('pan');
    });
    expect(toolbar()).toBeNull();
    act(() => {
      ui().setCanvasGesture(null);
    });
    expect(toolbar()).not.toBeNull();
    act(() => {
      ui().startTitleEdit({ target: 'node', id: 'a', isNew: false });
    });
    expect(toolbar()).toBeNull();
    act(() => {
      ui().endTitleEdit();
      ui().setHideUi(true);
    });
    expect(toolbar()).toBeNull();
    act(() => {
      ui().setHideUi(false);
      ui().openFlow('f');
    });
    expect(toolbar()).toBeNull();
  });

  it('names the connection variant and shows nothing for stickies only', () => {
    setup();
    act(() => {
      ui().select({ edges: ['e'] });
    });
    expect(
      screen.getByRole('toolbar', { name: 'Selection: connection writes' }),
    ).toBeInTheDocument();
    act(() => {
      ui().select({ stickies: ['s'] });
    });
    expect(toolbar()).toBeNull();
  });

  it('flips below the selection near the top of the window', () => {
    setup();
    const node = document.querySelector('.react-flow__node[data-id="a"]');
    if (!(node instanceof HTMLElement)) throw new Error('no node');
    node.getBoundingClientRect = () => new DOMRect(600, 100, 164, 50);
    select(['a']);
    const wrapper = screen.getByRole('toolbar').parentElement;
    expect(wrapper?.style.top).toBe('162px');
    node.getBoundingClientRect = () => new DOMRect(600, 400, 164, 50);
    act(() => {
      ui().select({ nodes: ['a'], edges: [] });
    });
    // 400 − 12 − 44 (jsdom has no layout: the toolbar's own height falls back to 44).
    expect(wrapper?.style.top).toBe('344px');
  });

  it('sets Owner on two components as one undo step, and says so', async () => {
    const { user, doc, editor } = setup();
    select(['a', 'b']);
    await user.click(screen.getByRole('button', { name: 'Owner: Mixed' }));
    expect(screen.getByRole('button', { name: 'Owner: Mixed' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const dialog = screen.getByRole('dialog', { name: 'Owner' });
    expect(within(dialog).getByText('Mixed')).toBeInTheDocument();
    expect(within(dialog).getByRole('searchbox', { name: 'Filter owner' })).toHaveFocus();
    await user.keyboard('pay');
    await user.click(within(dialog).getByRole('option', { name: /Payments team/ }));
    const owners = () => toJSON(doc).nodes.map((n) => n.owner);
    expect(owners()).toEqual(['Payments team', 'Payments team', 'Payments team']);
    expect(ui().announcement.text).toBe('Owner set to Payments team on 2 components');
    expect(screen.queryByRole('dialog', { name: 'Owner' })).toBeNull();
    act(() => {
      editor().undo();
    });
    expect(owners()).toEqual(['Checkout', 'Payments team', 'Payments team']);
  });

  it('clears the owner with "No owner" and applies a partial tag to all', async () => {
    const { user, doc } = setup();
    select(['a', 'b']);
    await user.click(screen.getByRole('button', { name: 'Owner: Mixed' }));
    await user.click(screen.getByRole('option', { name: 'No owner' }));
    expect(
      toJSON(doc)
        .nodes.slice(0, 2)
        .map((n) => n.owner),
    ).toEqual([undefined, undefined]);

    await user.click(screen.getByRole('button', { name: 'Tags' }));
    const list = screen.getByRole('listbox', { name: 'Tags options' });
    expect(list).toHaveAttribute('aria-multiselectable', 'true');
    await user.click(within(list).getByRole('option', { name: 'pci, 1 of 2' }));
    expect(
      toJSON(doc)
        .nodes.slice(0, 2)
        .map((n) => n.tags),
    ).toEqual([['pci'], ['pci']]);
    // The tags popover stays open for more picks.
    expect(screen.getByRole('dialog', { name: 'Tags' })).toBeInTheDocument();
  });

  it('closes a popover with Esc and gives focus back to its button', async () => {
    const { user } = setup();
    select(['a']);
    await user.click(screen.getByRole('button', { name: 'Kind: Service' }));
    expect(screen.getByRole('dialog', { name: 'Kind' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Kind' })).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Kind: Service' })).toHaveFocus();
    });
    expect(ui().selection.nodes).toEqual(['a']);
  });

  it('shows a pick in the open drawer at once, with no copy of its own (FR-027, FR-047)', async () => {
    const { user } = setup();
    select(['a']);
    await user.click(screen.getByRole('button', { name: 'Open details' }));
    const drawer = screen.getByRole('complementary', { name: 'Details' });
    // The drawer focuses its title one frame after opening.
    await waitFor(() => {
      expect(within(drawer).getByRole('textbox', { name: 'Title' })).toHaveFocus();
    });
    await user.click(screen.getByRole('button', { name: 'Kind: Service' }));
    await user.keyboard('data{Enter}');
    expect(screen.getByRole('button', { name: 'Kind: Database' })).toBeInTheDocument();
    expect(within(drawer).getByRole('combobox', { name: 'Kind' })).toHaveValue('Database');
  });

  it('previews a new deck colour on the card, and Cancel clears it without an undo step (020 T048)', async () => {
    const { user, doc, editor } = setup();
    select(['a']);
    await user.click(screen.getByRole('button', { name: 'Colour: none' }));
    const dialog = await screen.findByRole('dialog', { name: 'Colour' });
    await user.click(within(dialog).getByRole('button', { name: 'Add a deck colour' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Hex colour' }), '7A3CFF');

    const nodeA = document.querySelector('[data-node-id="a"]');
    expect(nodeA).not.toBeNull();
    expect(nodeA).toHaveAttribute(
      'aria-description',
      expect.stringContaining('Custom fill #7a3cff'),
    );
    expect(toJSON(doc).nodes.find((n) => n.id === 'a')?.style).toBeUndefined();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(nodeA).not.toHaveAttribute('aria-description', expect.stringContaining('#7a3cff'));
    expect(toJSON(doc).nodes.find((n) => n.id === 'a')?.style).toBeUndefined();
    expect(toJSON(doc).swatches).toBeUndefined();
    expect(editor().canUndo()).toBe(false);
  });
});

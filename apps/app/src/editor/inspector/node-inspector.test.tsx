import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { deckOf } from '../../test/render-canvas';
import { inspectorDeck } from '../../test/inspector-fixtures';
import { renderInspector } from '../../test/render-inspector';
import { cardSize, NODE_SIZE } from '../canvas-geometry';

const setup = () => renderInspector(inspectorDeck, { nodes: ['p'] });
const node = (doc: Parameters<typeof toJSON>[0]) => toJSON(doc).nodes[1];

describe('NodeInspector (story 1, FR-008)', () => {
  it('shows the kind tile, title and "Type · Group · id", and deletes through the dialog', async () => {
    const { user, ui } = setup();
    expect(screen.getByRole('heading', { name: 'Pricing Service' })).toBeInTheDocument();
    expect(screen.getByText('Service · Core · p')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete component' }));
    expect(ui().pendingDelete).toEqual({ targets: [{ scope: 'nodes', id: 'p' }] });
  });

  it('changes type and group by picking, each one undo step; "No group" clears', async () => {
    const { user, doc, editor } = setup();
    const kind = screen.getByRole('combobox', { name: 'Type' });
    await user.clear(kind);
    await user.type(kind, 'data');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(node(doc)?.type).toBe('database');
    const group = screen.getByRole('combobox', { name: 'Group' });
    await user.clear(group);
    await user.type(group, 'no');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(node(doc)?.group).toBeUndefined();
    expect(screen.getByText('Database · No group · p')).toBeInTheDocument();
    act(() => {
      editor().undo();
    });
    expect(node(doc)).toMatchObject({ type: 'database', group: 'core' });
    act(() => {
      editor().undo();
    });
    expect(node(doc)?.type).toBe('service');
  });

  it('edits every knowledge field, and one ⌘Z undoes only the last one', async () => {
    const { user, doc, editor } = setup();
    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.type(title, ' v2');
    await user.type(
      screen.getByRole('textbox', { name: 'Description' }),
      'Returns a fee.{Enter}{Enter}- uses `Delivery tier`',
    );
    await user.click(screen.getByRole('radio', { name: 'Preview' }));
    const preview = screen.getByRole('region', { name: 'Description preview' });
    expect(within(preview).getByRole('listitem')).toHaveTextContent('uses Delivery tier');

    const owner = screen.getByRole('combobox', { name: 'Owner' });
    await user.clear(owner);
    await user.type(owner, 'Or');
    expect(
      within(screen.getByRole('listbox', { name: 'Owner suggestions' })).getByRole('option', {
        name: 'Orders',
      }),
    ).toBeInTheDocument();
    await user.clear(owner);
    await user.type(owner, 'Platform{Enter}');
    const tech = screen.getByRole('textbox', { name: 'Tech' });
    await user.clear(tech);
    await user.type(tech, 'Python{Enter}');
    await user.type(screen.getByRole('textbox', { name: 'Host' }), 'eu-west k8s{Enter}');
    await user.click(screen.getByRole('button', { name: 'Add tag' }));
    await user.type(
      await screen.findByRole('searchbox', { name: 'Filter tags' }),
      ' Audit {Enter}Billing{Enter}',
    );
    const addLink = screen.getByRole('textbox', { name: 'Add link' });
    await user.type(addLink, 'javascript:alert(1){Enter}');
    expect(screen.getByText('Only http, https or relative links')).toBeInTheDocument();
    await user.clear(addLink);
    await user.type(addLink, 'https://runbooks.example.com/pricing{Enter}');
    await user.tab();

    expect(node(doc)).toMatchObject({
      title: 'Pricing Service v2',
      description: 'Returns a fee.\n\n- uses `Delivery tier`',
      owner: 'Platform',
      tech: 'Python',
      host: 'eu-west k8s',
      tags: ['critical', 'pci', 'Audit', 'Billing'],
      links: [{ url: 'https://runbooks.example.com/pricing', label: 'runbooks.example.com' }],
    });
    expect(screen.getByRole('heading', { name: 'Pricing Service v2' })).toBeInTheDocument();
    act(() => {
      editor().undo();
    });
    expect(node(doc)?.links).toBeUndefined();
    expect(node(doc)?.tags).toEqual(['critical', 'pci', 'Audit', 'Billing']);
  });

  it('lists connections with direction, and choosing one selects it', async () => {
    const { user, ui } = setup();
    const list = screen.getByRole('list', { name: 'Connections' });
    expect(screen.getByRole('heading', { name: 'Connections · 3' })).toBeInTheDocument();
    expect(
      within(list)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['← Order Service', '→ Payment Service', '← Dispatch Service']);
    await user.click(within(list).getByRole('button', { name: '→ Payment Service' }));
    expect(ui().selection).toEqual({ nodes: [], edges: ['py'], groups: [], stickies: [] });
    expect(
      screen.getByRole('heading', { name: 'Pricing Service → Payment Service' }),
    ).toBeInTheDocument();
  });

  it('shows the component level and marks derived levels', () => {
    renderInspector(inspectorDeck, { nodes: ['p'] });
    expect(screen.getByText('Level')).toBeInTheDocument();
    expect(screen.getByText('Container (derived)')).toBeInTheDocument();

    const explicitDeck = deckOf({
      nodes: [{ id: 'svc', type: 'service', title: 'Service', level: 'system' }],
    });
    const { unmount } = renderInspector(explicitDeck, { nodes: ['svc'] });
    expect(screen.getByText('System')).toBeInTheDocument();
    unmount();
  });

  it('pins and unpins the component in the current view, one undo step each (011)', async () => {
    const { user, doc, editor } = setup();
    const pin = screen.getByRole('switch', { name: 'Pin position' });
    expect(pin).toHaveAttribute('aria-checked', 'false');
    await user.click(pin);
    expect(toJSON(doc).views.find((v) => v.id === 'system')?.pinned).toEqual(['p']);
    expect(pin).toHaveAttribute('aria-checked', 'true');
    await user.click(pin);
    expect(toJSON(doc).views.find((v) => v.id === 'system')?.pinned).toBeUndefined();
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).views.find((v) => v.id === 'system')?.pinned).toEqual(['p']);
  });
});

describe('NodeInspector Size fields (017 T049)', () => {
  it('shows the level default size, disables "Reset size" until stored, one undo step per commit', async () => {
    const { user, doc, editor } = setup();
    // The card has tags, so its default height includes the tag block (2026-10-03).
    const tall = cardSize({ ...node(doc) }, 'system').height;
    expect(tall).toBeGreaterThan(NODE_SIZE.height);
    const width = screen.getByRole('spinbutton', { name: 'Width' });
    const height = screen.getByRole('spinbutton', { name: 'Height' });
    expect(width).toHaveValue(184);
    expect(height).toHaveValue(tall);
    const reset = screen.getByRole('button', { name: 'Reset size' });
    expect(reset).toBeDisabled();

    await user.clear(width);
    await user.type(width, '300{Enter}');
    expect(node(doc)?.size).toEqual({ width: 300, height: tall });
    expect(reset).not.toBeDisabled();

    await user.clear(height);
    await user.type(height, '120');
    await user.tab();
    expect(node(doc)?.size).toEqual({ width: 300, height: 120 });

    act(() => {
      editor().undo();
    });
    expect(node(doc)?.size).toEqual({ width: 300, height: tall });
    act(() => {
      editor().undo();
    });
    expect(node(doc)?.size).toBeUndefined();
  });

  it('clamps to the resize limits, and "Reset size" clears the stored size in one undo step', async () => {
    const { user, doc, editor, ui } = setup();
    const width = screen.getByRole('spinbutton', { name: 'Width' });
    await user.clear(width);
    await user.type(width, '10{Enter}');
    expect(node(doc)?.size?.width).toBe(120);
    await user.clear(width);
    await user.type(width, '5000{Enter}');
    expect(node(doc)?.size?.width).toBe(800);

    await user.click(screen.getByRole('button', { name: 'Reset size' }));
    expect(node(doc)?.size).toBeUndefined();
    expect(ui().announcement.text).toBe('Size reset');
    act(() => {
      editor().undo();
    });
    expect(node(doc)?.size?.width).toBe(800);
  });
});

describe('Show as (031 US3)', () => {
  const formDeck = deckOf({
    nodes: [
      {
        id: 'db',
        type: 'database',
        title: 'Orders DB',
        description: 'Holds orders.',
        tags: ['pci'],
      },
      { id: 'svc', type: 'service', title: 'Svc' },
    ],
  });

  it('offers a "Show as" radio group for a type with two forms, switching in one undo step', async () => {
    const { doc, editor, user } = renderInspector(formDeck, { nodes: ['db'] });
    const group = screen.getByRole('radiogroup', { name: 'Show as' });
    expect(within(group).getByRole('radio', { name: 'Card' })).toBeChecked();
    await user.click(within(group).getByRole('radio', { name: 'Shape' }));
    expect(toJSON(doc).nodes[0]?.display).toBe('shape');
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).nodes[0]?.display).toBeUndefined();
  });

  it('keeps description and tags editable in shape form', () => {
    const shaped = { ...formDeck, nodes: [{ ...formDeck.nodes[0], display: 'shape' as const }] };
    renderInspector(shaped as typeof formDeck, { nodes: ['db'] });
    expect(screen.getByRole('radio', { name: 'Shape' })).toBeChecked();
    expect(screen.getByText('Holds orders.')).toBeInTheDocument();
    expect(screen.getByText('pci')).toBeInTheDocument();
  });

  it('is absent for a type with one form', () => {
    renderInspector(formDeck, { nodes: ['svc'] });
    expect(screen.queryByRole('radiogroup', { name: 'Show as' })).not.toBeInTheDocument();
  });
});

describe('NodeInspector icon tile (038 T022)', () => {
  const tile = () => screen.getByRole('button', { name: 'Change icon' });

  it('is a "Change icon" button that opens the picker and writes the pick', async () => {
    const { user, doc } = setup();
    await user.hover(tile());
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Type icon');
    await user.click(tile());
    const dialog = await screen.findByRole('dialog', { name: 'Choose icon' });
    expect(within(dialog).getByRole('searchbox', { name: 'Search icons' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Zap' }));
    expect(node(doc)?.icon).toBe('lucide:zap');
    expect(screen.queryByRole('dialog', { name: 'Choose icon' })).not.toBeInTheDocument();
    expect(tile().querySelector('[data-icon="lucide:zap"]')).not.toBeNull();
    // The type name stays in the subtitle.
    expect(screen.getByText('Service · Core · p')).toBeInTheDocument();
    expect(tile()).toHaveFocus();
  });

  it('opens with Enter and returns focus to the tile on Escape', async () => {
    const { user } = setup();
    tile().focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('dialog', { name: 'Choose icon' });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Choose icon' })).not.toBeInTheDocument();
    expect(tile()).toHaveFocus();
  });

  it('names the current icon in the tooltip', async () => {
    const { user, editor } = setup();
    act(() => {
      editor().setNodeIcon(['p'], 'lucide:server');
    });
    await user.hover(tile());
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Server');
  });

  it('is a plain tile, not a button, for a node drawn as a shape', () => {
    renderInspector(
      deckOf({ nodes: [{ id: 'r', type: 'rectangle', title: 'Box', icon: 'mdi:database' }] }),
      { nodes: ['r'] },
    );
    expect(screen.getByRole('heading', { name: 'Box' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change icon' })).not.toBeInTheDocument();
  });
});

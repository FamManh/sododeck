import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { inspectorDeck } from '../../test/inspector-fixtures';
import { useUiStore } from '../../state/ui-store';
import { InspectorView } from '../../test/inspector-view';
import { renderInspector } from '../../test/render-inspector';
import { renderWithEditor } from '../../test/render-canvas';
import { SelectionToolbar } from '../quick-edit/selection-toolbar';

/** Pricing (Orders, critical+pci, core), Payment (Payments, critical), Dispatch (Dispatch, core). */
const setup = (edges: string[] = []) =>
  renderInspector(inspectorDeck, { nodes: ['p', 'y', 'd'], edges });
const nodes = (doc: Parameters<typeof toJSON>[0]) =>
  toJSON(doc).nodes.filter((n) => ['p', 'y', 'd'].includes(n.id));

describe('BulkInspector (story 3, FR-013–FR-017)', () => {
  it('shows Mixed with an accessible description, "Same on all 3", and partial tags', () => {
    setup();
    expect(screen.getByRole('heading', { name: '3 components selected' })).toBeInTheDocument();
    expect(
      screen.getByText('Pricing Service, Payment Service, Dispatch Service'),
    ).toBeInTheDocument();
    const owner = screen.getByRole('combobox', { name: 'Owner' });
    expect(owner).toHaveAttribute('placeholder', 'Mixed');
    expect(owner).toHaveValue('');
    expect(owner).toHaveAccessibleDescription('Mixed values');
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveAccessibleDescription(
      'Same on all 3',
    );
    expect(screen.getByRole('textbox', { name: 'Tech' })).toHaveAccessibleDescription(
      'Same on all 3',
    );
    expect(screen.getByRole('combobox', { name: 'Group' })).toHaveAccessibleDescription(
      'Mixed values',
    );
    const tags = screen.getByRole('list', { name: 'Tags' });
    const critical = within(tags).getByText('critical').closest('[data-slot="tag-chip"]');
    expect(critical).toHaveClass('border-dashed');
    expect(critical).toHaveTextContent('critical2/3');
    expect(screen.getByText(/Fields marked Mixed keep each component/)).toBeInTheDocument();
  });

  it('colours each bulk tag with its own tag colour, dashed on some, and counts spellings once (033)', () => {
    const file = {
      ...inspectorDeck,
      tagColors: { critical: 'red' },
    };
    renderInspector(file, { nodes: ['p', 'y', 'd'] });
    const tags = screen.getByRole('list', { name: 'Tags' });
    const critical = within(tags).getByText('critical').closest('[data-slot="tag-chip"]');
    expect(critical).toHaveStyle({ '--tag-chip': 'var(--color-card-red-chip)' });
    expect(critical).toHaveClass('border-dashed');
    const pci = within(tags).getByText('pci').closest('[data-slot="tag-chip"]');
    expect(pci).toHaveStyle({ '--tag-chip': 'var(--color-card-slate-chip)' });
  });

  it('changes nothing when a Mixed field is left without typing', async () => {
    const { user, doc, editor } = setup();
    const before = nodes(doc);
    await user.click(screen.getByRole('combobox', { name: 'Owner' }));
    await user.tab();
    expect(nodes(doc)).toEqual(before);
    expect(editor().canUndo()).toBe(false);
  });

  it('sets the owner on all, and one ⌘Z restores each own previous owner', async () => {
    const { user, doc, editor } = setup();
    await user.type(screen.getByRole('combobox', { name: 'Owner' }), 'Dispatch{Enter}');
    await user.tab();
    expect(nodes(doc).map((n) => n.owner)).toEqual(['Dispatch', 'Dispatch', 'Dispatch']);
    act(() => {
      editor().undo();
    });
    expect(nodes(doc).map((n) => n.owner)).toEqual(['Orders', 'Payments', 'Dispatch']);
  });

  it('sets type and group on all, each one undo step', async () => {
    const { user, doc, editor } = setup();
    const group = screen.getByRole('combobox', { name: 'Group' });
    await user.type(group, 'Core');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(nodes(doc).map((n) => n.group)).toEqual(['core', 'core', 'core']);
    const kind = screen.getByRole('combobox', { name: 'Type' });
    await user.clear(kind);
    await user.type(kind, 'queue');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(nodes(doc).map((n) => n.type)).toEqual(['queue', 'queue', 'queue']);
    act(() => {
      editor().undo();
    });
    expect(nodes(doc).map((n) => n.type)).toEqual(['service', 'service', 'service']);
    act(() => {
      editor().undo();
    });
    expect(nodes(doc).map((n) => n.group)).toEqual(['core', undefined, undefined]);
  });

  it('adds a partial tag to all and removes a tag from all, one undo step each', async () => {
    const { user, doc, editor } = setup();
    await user.click(screen.getByRole('button', { name: 'Add critical to all' }));
    expect(nodes(doc).map((n) => n.tags)).toEqual([
      ['critical', 'pci'],
      ['critical'],
      ['core', 'critical'],
    ]);
    const chip = screen.getByText('critical').closest('[data-slot="tag-chip"]');
    expect(chip).not.toHaveClass('border-dashed');
    await user.click(screen.getByRole('button', { name: 'Remove critical from all' }));
    expect(nodes(doc).map((n) => n.tags)).toEqual([['pci'], undefined, ['core']]);
    act(() => {
      editor().undo();
    });
    expect(nodes(doc).map((n) => n.tags)).toEqual([
      ['critical', 'pci'],
      ['critical'],
      ['core', 'critical'],
    ]);
    await user.click(screen.getByRole('button', { name: 'Add tag' }));
    await user.type(await screen.findByRole('searchbox', { name: 'Filter tags' }), 'Tier-1{Enter}');
    expect(nodes(doc).every((n) => n.tags?.includes('Tier-1'))).toBe(true);
  });

  it('with connections too, states both counts and changes components only', async () => {
    const { user, doc } = setup(['op']);
    expect(
      screen.getByRole('heading', { name: '3 components, 1 connection selected' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Changes apply to components only.')).toBeInTheDocument();
    const before = toJSON(doc).edges;
    await user.type(screen.getByRole('combobox', { name: 'Owner' }), 'Core{Enter}');
    expect(toJSON(doc).edges).toEqual(before);
  });

  it('opens the delete confirmation for the components', async () => {
    const { user, ui } = setup();
    await user.click(screen.getByRole('button', { name: 'Delete 3 components' }));
    expect(ui().pendingDelete?.targets).toEqual([
      { scope: 'nodes', id: 'p' },
      { scope: 'nodes', id: 'y' },
      { scope: 'nodes', id: 'd' },
    ]);
  });

  it('shows "Fill: Mixed" when styles differ, and applies fill to all as one undo step (020 T038)', async () => {
    const { user, doc, editor } = setup();
    act(() => {
      editor().setStyle({ nodes: ['p'], groups: [] }, 'fill', 'green');
    });
    expect(screen.getByRole('button', { name: 'Fill: Mixed' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fill: Mixed' }));
    await user.click(screen.getByRole('radio', { name: 'Amber' }));
    expect(nodes(doc).map((n) => n.style?.fill)).toEqual(['amber', 'amber', 'amber']);
    act(() => {
      editor().undo();
    });
    expect(nodes(doc).map((n) => n.style?.fill)).toEqual(['green', undefined, undefined]);
  });

  it('reads the skipped-items footer when a connection is also selected (020 T038)', async () => {
    const { user } = setup(['op']);
    await user.click(screen.getByRole('button', { name: 'Fill: none' }));
    expect(screen.getByRole('status')).toHaveTextContent('Colours 3 of 4 selected items');
  });

  it('says when only some are pinned, and pins them all in one undo step (011)', async () => {
    const { user, doc, editor } = setup();
    act(() => {
      editor().setPinned('system', ['p'], true);
    });
    const pin = screen.getByRole('switch', { name: 'Pin position' });
    expect(pin).toHaveAccessibleDescription(
      'Some of the selected components are pinned in this view',
    );
    await user.click(pin);
    expect(toJSON(doc).views[0]?.pinned).toEqual(['p', 'y', 'd']);
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).views[0]?.pinned).toEqual(['p']);
  });
});

describe('BulkInspector typed fields (032 FR-016)', () => {
  const warehouses = {
    ...inspectorDeck,
    packs: ['architecture', 'process', 'logistics', 'data'],
    fields: [
      {
        id: 'region',
        name: 'Zone',
        kind: 'select' as const,
        types: ['warehouse'],
        options: [
          { id: 'n', label: 'North' },
          { id: 's', label: 'South' },
        ],
      },
    ],
    nodes: [
      ...inspectorDeck.nodes,
      { id: 'w1', type: 'warehouse', title: 'W1', values: { region: 'n', 'warehouse.sla': 4 } },
      { id: 'w2', type: 'warehouse', title: 'W2', values: { region: 's', 'warehouse.sla': 4 } },
      { id: 'w3', type: 'warehouse', title: 'W3', values: { 'warehouse.sla': 4 } },
      { id: 't1', type: 'task', title: 'T1' },
    ],
  };

  it('shows Mixed where values differ and "Same on all 3" where they agree', () => {
    renderInspector(warehouses, { nodes: ['w1', 'w2', 'w3'] });
    const region = screen.getByRole('combobox', { name: 'Zone' });
    expect(region).toHaveAttribute('placeholder', 'Mixed');
    expect(region).toHaveAccessibleDescription('Mixed values');
    expect(screen.getByRole('spinbutton', { name: 'SLA h' })).toHaveValue('4');
    expect(screen.getByRole('spinbutton', { name: 'SLA h' })).toHaveAccessibleDescription(
      'Same on all 3',
    );
  });

  it('sets a value on all three in one undo step', async () => {
    const { user, doc, editor } = renderInspector(warehouses, { nodes: ['w1', 'w2', 'w3'] });
    await user.click(screen.getByRole('combobox', { name: 'Zone' }));
    await user.click(screen.getByRole('option', { name: 'South' }));
    const regions = () =>
      toJSON(doc)
        .nodes.filter((n) => n.type === 'warehouse')
        .map((n) => n.values?.region);
    expect(regions()).toEqual(['s', 's', 's']);
    act(() => {
      editor().undo();
    });
    expect(regions()).toEqual(['n', 's', undefined]);
  });

  it('lists only fields every card has for a mixed-type selection', () => {
    renderInspector(warehouses, { nodes: ['w1', 't1'] });
    const list = screen.getByRole('list', { name: 'Fields' });
    expect(within(list).getByRole('combobox', { name: 'Owner' })).toBeInTheDocument();
    expect(within(list).queryByRole('combobox', { name: 'Zone' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Owner on card' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add field' })).not.toBeInTheDocument();
  });
});

describe('BulkInspector and icons (038 T030)', () => {
  it('has no icon entry: multi-select icon changes go through the toolbar and menu', () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Change icon' })).not.toBeInTheDocument();
    expect(screen.queryByText('Icon')).not.toBeInTheDocument();
  });

  it('the toolbar picker with the bulk drawer open applies to every selected card in one step', async () => {
    const env = renderWithEditor(
      <>
        <InspectorView />
        <SelectionToolbar />
      </>,
      inspectorDeck,
    );
    const user = userEvent.setup();
    act(() => {
      useUiStore.getState().select({ nodes: ['p', 'y', 'd'] });
    });
    expect(screen.getByRole('heading', { name: '3 components selected' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Icon' }));
    const dialog = await screen.findByRole('dialog', { name: 'Choose icon' });
    expect(within(dialog).getByText('Changes 3 cards')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Zap' }));
    expect(nodes(env.doc).map((n) => n.icon)).toEqual(['lucide:zap', 'lucide:zap', 'lucide:zap']);
    act(() => {
      env.editor().undo();
    });
    expect(nodes(env.doc).map((n) => n.icon)).toEqual([undefined, undefined, undefined]);
  });
});

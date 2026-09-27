import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { inspectorDeck } from '../../test/inspector-fixtures';
import { renderInspector } from '../../test/render-inspector';

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
    expect(screen.getByRole('combobox', { name: 'Kind' })).toHaveAccessibleDescription(
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

  it('sets kind and group on all, each one undo step', async () => {
    const { user, doc, editor } = setup();
    const group = screen.getByRole('combobox', { name: 'Group' });
    await user.type(group, 'Core');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(nodes(doc).map((n) => n.group)).toEqual(['core', 'core', 'core']);
    const kind = screen.getByRole('combobox', { name: 'Kind' });
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
    await user.type(screen.getByRole('combobox', { name: 'Add tag' }), 'Tier-1{Enter}');
    expect(nodes(doc).every((n) => n.tags?.includes('tier-1'))).toBe(true);
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
});

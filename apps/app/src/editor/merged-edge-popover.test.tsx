import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { deckOf, editorWrapper } from '../test/render-canvas';
import { bundleEdges } from './bundles';
import { MergedEdgePopover } from './merged-edge-popover';
import { schemaGroupedDeck } from './schema-groups';
import { scopeOf, visibleGraph } from './visible-graph';
import { collapsedOf } from './views/use-current-view';

describe('MergedEdgePopover', () => {
  it('lists the merged connections and expands their groups when a row is chosen', async () => {
    const user = userEvent.setup();
    const deck = deckOf({
      nodes: [
        { id: 'a', type: 'service', title: 'A', group: 'left' },
        { id: 'b', type: 'service', title: 'B', group: 'right' },
      ],
      groups: [
        { id: 'left', title: 'Left' },
        { id: 'right', title: 'Right' },
      ],
      views: [{ id: 'v', type: 'system', title: 'V', collapsed: ['left', 'right'] }],
      edges: Array.from({ length: 12 }, (_, index) => ({
        id: `e${String(index)}`,
        from: 'a',
        to: 'b',
        label: `Connection ${String(index + 1)}`,
      })),
    });
    const env = editorWrapper(deck);
    act(() => {
      useUiStore.setState({
        popover: { kind: 'merged', edgeId: 'merged:collapsed:left|collapsed:right' },
      });
    });
    render(<MergedEdgePopover deck={deck} />, { wrapper: env.wrapper });

    expect(
      screen.getByRole('dialog', { name: 'Connections between Left and Right' }),
    ).toBeInTheDocument();
    const options = screen.getAllByRole('option');
    const [first] = options;
    if (first === undefined) throw new Error('Expected merged connection option');
    expect(options).toHaveLength(12);
    expect(first).toHaveTextContent('Connection 1');
    await user.click(first);
    expect(collapsedOf(env.doc).size).toBe(0);
    expect(useUiStore.getState().selection.edges).toEqual(['e0']);
  });

  it('lists relationships as table.column → table.column · cardinality and selects one (048)', async () => {
    const user = userEvent.setup();
    const deck = deckOf({
      nodes: [
        {
          id: 'orders',
          type: 'db-table',
          title: 'orders',
          schema: 'sales',
          columns: [
            { id: 'c-id', name: 'id', type: 'uuid', pk: true },
            { id: 'c-cust', name: 'customer_id', type: 'uuid' },
          ],
        },
        {
          id: 'customers',
          type: 'db-table',
          title: 'customers',
          schema: 'crm',
          columns: [{ id: 'k-id', name: 'id', type: 'uuid', pk: true }],
        },
      ],
      groupingMode: 'schema',
      views: [{ id: 'v', type: 'system', title: 'V', collapsed: ['schema:sales', 'schema:crm'] }],
      edges: [
        {
          id: 'fk',
          from: 'orders',
          to: 'customers',
          fromColumns: ['c-cust'],
          toColumns: ['k-id'],
          cardinality: 'n-1',
        },
      ],
    });
    const env = editorWrapper(deck);
    act(() => {
      useUiStore.setState({
        popover: { kind: 'merged', edgeId: 'merged:collapsed:schema:crm|collapsed:schema:sales' },
      });
    });
    render(<MergedEdgePopover deck={schemaGroupedDeck(deck)} />, { wrapper: env.wrapper });
    const option = screen.getByRole('option', {
      name: /^orders\.customer_id → customers\.id · n-1/,
    });
    await user.click(option);
    expect(useUiStore.getState().selection.edges).toEqual(['fk']);
    expect(collapsedOf(env.doc).size).toBe(0);
  });

  describe('for a bundle (034)', () => {
    const deck = deckOf({
      nodes: [
        { id: 'a', type: 'service', title: 'A' },
        { id: 'b', type: 'service', title: 'B' },
      ],
      edges: [
        { id: 'e1', from: 'a', to: 'b', label: 'orders' },
        { id: 'e2', from: 'b', to: 'a', label: 'replies' },
        { id: 'e3', from: 'a', to: 'b' },
      ],
    });
    const none = new Set<string>();
    const open = (fanned: string[] = []) => {
      const env = editorWrapper(deck);
      const graph = visibleGraph(deck, scopeOf([]), none);
      const bundles = bundleEdges(deck, graph, {
        exclude: none,
        fanned: new Set(fanned),
        off: false,
      });
      act(() => {
        useUiStore.setState({ popover: { kind: 'merged', edgeId: 'bundle:a|b' } });
      });
      render(<MergedEdgePopover deck={deck} bundles={bundles} />, { wrapper: env.wrapper });
      return env;
    };

    it('starts with Fan out, then lists each connector with label and direction', () => {
      open();
      expect(
        screen.getByRole('dialog', { name: 'Connections between A and B' }),
      ).toBeInTheDocument();
      const buttons = screen
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label') ?? b.textContent);
      expect(buttons[0]).toBe('Fan out');
      const rows = screen.getAllByRole('listitem');
      expect(rows).toHaveLength(3);
      expect(rows[0]).toHaveTextContent('orders');
      expect(rows[0]).toHaveTextContent('forward');
      expect(rows[2]).toHaveTextContent('A → B');
    });

    it('toggles the fan-out and says Fold while fanned', async () => {
      const user = userEvent.setup();
      useUiStore.setState({ fannedBundles: new Set() });
      open();
      await user.click(screen.getByRole('button', { name: 'Fan out' }));
      expect([...useUiStore.getState().fannedBundles]).toEqual(['bundle:a|b']);
    });

    it('offers Fold when the bundle is fanned', () => {
      open(['bundle:a|b']);
      expect(screen.getByRole('button', { name: 'Fold' })).toBeInTheDocument();
    });

    it('selects one connector', async () => {
      const user = userEvent.setup();
      open();
      await user.click(screen.getByRole('button', { name: 'Select orders' }));
      expect(useUiStore.getState().selection.edges).toEqual(['e1']);
      expect(useUiStore.getState().popover).toBeNull();
    });

    it('deletes one connector through the confirmation, as one request', async () => {
      const user = userEvent.setup();
      open();
      await user.click(screen.getByRole('button', { name: 'Delete replies' }));
      expect(useUiStore.getState().pendingDelete).not.toBeNull();
      expect(useUiStore.getState().pendingDelete?.targets).toEqual([{ scope: 'edges', id: 'e2' }]);
    });
  });
});

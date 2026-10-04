import { stickyCanvasPosition, toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type * as ReactFlow from '@xyflow/react';
import { vi } from 'vitest';

import { branchedDeck, flowDeck, playbackDeck } from '../../test/flow-fixtures';
import { renderFlows } from '../../test/render-flows';
import { openFlow } from './flow-mode';
import { startEditing } from './flow-session';

const setCenter = vi.fn();

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof ReactFlow>('@xyflow/react');
  return {
    ...actual,
    useReactFlow: () => ({
      setCenter,
      getZoom: () => 1,
      getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
      screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
      fitView: vi.fn(() => Promise.resolve(true)),
    }),
  };
});

describe('InspectorStep (US3, FR-019, FR-027)', () => {
  it('heads "Step n · from → to" and saves title, condition and SLA, in or out of a session', async () => {
    const { user, ui, doc, editor } = renderFlows(flowDeck);
    act(() => {
      startEditing(editor(), 'place');
      ui().setActiveStep('s2');
    });
    expect(
      screen.getByRole('heading', { name: 'Step 2 · API Gateway → Order Service' }),
    ).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Authorize payment{Enter}');
    await user.clear(screen.getByRole('textbox', { name: 'SLA target' }));
    await user.type(screen.getByRole('textbox', { name: 'SLA target' }), '< 300 ms{Enter}');
    const condition = screen.getByRole('textbox', { name: 'Condition' });
    await user.clear(condition);
    await user.keyboard('{Enter}');
    expect(toJSON(doc).flows[0]?.steps[1]).toEqual({
      id: 's2',
      edge: 'bc',
      title: 'Authorize payment',
      sla: '< 300 ms',
    });
    // The row's main line switches to the title (FR-019a).
    expect(screen.getByRole('button', { name: 'Step 2: Authorize payment' })).toBeInTheDocument();
  });

  it('lists the branches of the branch step, each selectable', async () => {
    const { user, ui } = renderFlows(branchedDeck);
    act(() => {
      ui().setActiveFlow('pay');
      ui().setActiveStep('p2');
    });
    const section = screen.getByRole('region', { name: 'Branches after this step' });
    const buttons = within(section).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([
      'a · payment okauthorized3a',
      'b · payment faileddeclined3b',
    ]);
    await user.click(buttons[1] as HTMLElement);
    expect(ui().activeFlow?.branchId).toBe('fail');
  });

  it('adds owner, edge, tags, links and a previewable description (008 story 2)', async () => {
    const deck = {
      ...flowDeck,
      edges: flowDeck.edges.map((e) => (e.id === 'bc' ? { ...e, protocol: 'http' as const } : e)),
    };
    const { user, ui, doc } = renderFlows(deck);
    act(() => {
      ui().setActiveFlow('place');
      ui().setActiveStep('s2');
    });
    // Outside a session an open flow is flow mode (007): the playback header names the step.
    expect(
      screen.getByRole('heading', { name: /^Step 2 of \d+ · Place order$/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('POST /orders · HTTP')).toBeInTheDocument();
    await user.type(screen.getByRole('combobox', { name: 'Owner' }), 'Orders{Enter}');
    await user.type(screen.getByRole('combobox', { name: 'Add tag' }), 'Quote{Enter}');
    await user.type(screen.getByRole('textbox', { name: 'Add link' }), 'docs/quote.md{Enter}');
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Asks `pricing`.');
    await user.click(screen.getByRole('radio', { name: 'Preview' }));
    expect(screen.getByRole('region', { name: 'Description preview' })).toHaveTextContent(
      'Asks pricing.',
    );
    expect(toJSON(doc).flows[0]?.steps[1]).toMatchObject({
      owner: 'Orders',
      tags: ['Quote'],
      links: [{ url: 'docs/quote.md', label: 'quote.md' }],
      description: 'Asks `pricing`.',
    });
  });

  it('shows the SLA target as text only, with no meter', () => {
    const deck = {
      ...flowDeck,
      flows: flowDeck.flows.map((f) =>
        f.id === 'place'
          ? { ...f, steps: f.steps.map((st) => (st.id === 's2' ? { ...st, sla: '< 120 ms' } : st)) }
          : f,
      ),
    };
    const { ui } = renderFlows(deck);
    act(() => {
      ui().setActiveFlow('place');
      ui().setActiveStep('s2');
    });
    expect(screen.getByRole('textbox', { name: 'SLA target' })).toHaveValue('< 120 ms');
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('marks a broken step "Connection deleted" and keeps its fields editable', async () => {
    const deck = { ...flowDeck, edges: flowDeck.edges.filter((e) => e.id !== 'bc') };
    const { user, ui, doc } = renderFlows(deck);
    act(() => {
      ui().setActiveFlow('place');
      ui().setActiveStep('s2');
    });
    const inspector = screen.getByRole('complementary', { name: 'Inspector' });
    // Once in the flow mode header, once in the Edge field.
    expect(within(inspector).getAllByText('Connection deleted')).toHaveLength(2);
    await user.type(screen.getByRole('combobox', { name: 'Owner' }), 'Core{Enter}');
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Still here{Enter}');
    expect(toJSON(doc).flows[0]?.steps[1]).toMatchObject({ owner: 'Core', title: 'Still here' });
  });
});

describe('InspectorStep in flow mode (007 FR-019–021)', () => {
  const inspector = () => screen.getByRole('complementary', { name: 'Inspector' });
  function setup(flowId: string, stepId: string) {
    const view = renderFlows(playbackDeck);
    act(() => {
      openFlow(view.editor(), flowId, stepId);
    });
    return view;
  }

  it('heads with the position, from/to tiles and protocol, and lists attached rules', () => {
    setup('order', 'o5');
    expect(
      within(inspector()).getByRole('heading', { name: 'Step 5 of 8 · Place order' }),
    ).toBeInTheDocument();
    expect(
      within(inspector()).getByRole('img', { name: 'From: Order Service' }),
    ).toBeInTheDocument();
    expect(
      within(inspector()).getByRole('img', { name: 'To: Payment Service' }),
    ).toBeInTheDocument();
    expect(within(inspector()).getByText('gRPC')).toBeInTheDocument();
    const rules = within(inspector()).getByRole('list', { name: 'Attached rules' });
    const items = within(rules).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Payment limits');
    expect(items[1]).toHaveTextContent('Missing rule r9');
    expect(within(inspector()).queryByRole('meter')).toBeNull();
  });

  it("draws each end's own icon in the from / to tiles (038)", () => {
    const iconed = {
      ...playbackDeck,
      nodes: playbackDeck.nodes.map((n) => (n.id === 'c' ? { ...n, icon: 'lucide:search' } : n)),
    };
    const view = renderFlows(iconed);
    act(() => {
      openFlow(view.editor(), 'order', 'o5');
    });
    const from = within(inspector()).getByRole('img', { name: 'From: Order Service' });
    expect(from.querySelector('[data-icon="lucide:search"]')).not.toBeNull();
    const to = within(inspector()).getByRole('img', { name: 'To: Payment Service' });
    expect(to.querySelector('[data-icon="lucide:search"]')).toBeNull();
  });

  it('says "No decision table" and "No SLA target" when empty, and keeps fields editable', async () => {
    const { user, doc } = setup('order', 'o4');
    expect(
      within(inspector()).getByRole('heading', { name: 'Step 4 of 8 · Place order' }),
    ).toBeInTheDocument();
    expect(within(inspector()).getByText('No decision table on this step.')).toBeInTheDocument();
    expect(within(inspector()).getByRole('textbox', { name: 'SLA target' })).toHaveAttribute(
      'placeholder',
      'No SLA target',
    );
    await user.type(within(inspector()).getByRole('textbox', { name: 'Title' }), 'Create{Enter}');
    expect(toJSON(doc).flows[0]?.steps[3]).toMatchObject({ title: 'Create' });
  });

  it('shows "Connection deleted" for a broken step', () => {
    setup('broken', 'k2');
    // In the header and in the Edge field.
    expect(within(inspector()).getAllByText('Connection deleted')).toHaveLength(2);
  });

  it('names the branch and marks an error path', () => {
    setup('fork', 'f4b');
    expect(
      within(inspector()).getByRole('heading', { name: 'Step 4b of 5 · Checkout' }),
    ).toBeInTheDocument();
    expect(within(inspector()).getByText('Branch payment failed')).toBeInTheDocument();
    expect(within(inspector()).getByText('· Error path')).toBeInTheDocument();
  });

  it('lists notes on this step as buttons that center the note without leaving flow mode', async () => {
    const deck = {
      ...playbackDeck,
      stickies: [
        { id: 'note-c', text: 'Retry later', anchor: 'c' },
        { id: 'note-x', text: 'Card decline', anchor: 'x' },
        { id: 'note-a', text: 'Customer copy', anchor: 'a' },
      ],
    };
    const { user, ui, editor } = renderFlows(deck);
    act(() => {
      openFlow(editor(), 'order', 'o5');
    });
    setCenter.mockClear();

    const section = within(inspector()).getByRole('region', { name: 'NOTES ON THIS STEP' });
    const buttons = within(section).getAllByRole('button');
    expect(
      buttons.map((button) => button.getAttribute('aria-label') ?? button.textContent),
    ).toEqual(['Retry later, pinned to Order Service', 'Card decline, pinned to Payment Service']);

    await user.click(buttons[1] as HTMLElement);
    const sticky = deck.stickies[1];
    if (sticky === undefined) throw new Error('Missing sticky fixture');
    const point = stickyCanvasPosition(deck, sticky).point;
    expect(setCenter).toHaveBeenCalledWith(point.x, point.y, { zoom: 1 });
    expect(ui().selection).toEqual({ nodes: [], edges: [], groups: [], stickies: [] });
    expect(ui().activeFlow?.flowId).toBe('order');

    act(() => {
      ui().setActiveStep('o8');
    });
    expect(within(inspector()).queryByRole('region', { name: 'NOTES ON THIS STEP' })).toBeNull();

    act(() => {
      ui().setActiveStep('o5');
    });
    expect(
      within(inspector()).getByRole('region', { name: 'NOTES ON THIS STEP' }),
    ).toBeInTheDocument();
  });
});

describe('InspectorStep Touches section (049 US3)', () => {
  it('shows the step’s touches with their access, in and out of flow mode', () => {
    const deck = {
      ...flowDeck,
      nodes: [
        ...flowDeck.nodes,
        {
          id: 'orders',
          type: 'db-table',
          title: 'orders',
          columns: [{ id: 'o-id', name: 'id', type: 'int' }],
        },
      ],
      flows: flowDeck.flows.map((flow, index) =>
        index === 0
          ? {
              ...flow,
              steps: flow.steps.map((step, i) =>
                i === 1
                  ? { ...step, touches: [{ table: 'orders', access: 'write' as const }] }
                  : step,
              ),
            }
          : flow,
      ),
    };
    const { ui, editor } = renderFlows(deck);
    act(() => {
      startEditing(editor(), 'place');
      ui().setActiveStep('s2');
    });
    const section = screen.getByRole('region', { name: 'Touches' });
    expect(within(section).getByRole('button', { name: 'Access for orders: write' })).toBeVisible();
  });
});

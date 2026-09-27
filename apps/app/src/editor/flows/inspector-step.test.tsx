import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { branchedDeck, flowDeck } from '../../test/flow-fixtures';
import { renderFlows } from '../../test/render-flows';

describe('InspectorStep (US3, FR-019, FR-027)', () => {
  it('heads "Step n · from → to" and saves title, condition and SLA, in or out of a session', async () => {
    const { user, ui, doc } = renderFlows(flowDeck);
    act(() => {
      ui().setActiveFlow('place');
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
    expect(screen.getByText('Place order · step 2')).toBeInTheDocument();
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
      tags: ['quote'],
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
    expect(within(inspector).getByText('Connection deleted')).toBeInTheDocument();
    await user.type(screen.getByRole('combobox', { name: 'Owner' }), 'Core{Enter}');
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Still here{Enter}');
    expect(toJSON(doc).flows[0]?.steps[1]).toMatchObject({ owner: 'Core', title: 'Still here' });
  });
});

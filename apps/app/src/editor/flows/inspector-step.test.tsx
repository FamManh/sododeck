import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { branchedDeck, flowDeck, playbackDeck } from '../../test/flow-fixtures';
import { renderFlows } from '../../test/render-flows';
import { openFlow } from './flow-mode';
import { startEditing } from './flow-session';

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
    const rules = within(inspector()).getByRole('region', { name: 'Rules' });
    expect(
      within(rules)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Payment limits', 'Missing rule r9']);
    expect(within(inspector()).queryByRole('meter')).toBeNull();
  });

  it('says "No rules attached" and "No SLA target" when empty, and keeps fields editable', async () => {
    const { user, doc } = setup('order', 'o4');
    expect(
      within(inspector()).getByRole('heading', { name: 'Step 4 of 8 · Place order' }),
    ).toBeInTheDocument();
    expect(within(inspector()).getByText('No rules attached')).toBeInTheDocument();
    expect(within(inspector()).getByRole('textbox', { name: 'SLA target' })).toHaveAttribute(
      'placeholder',
      'No SLA target',
    );
    await user.type(within(inspector()).getByRole('textbox', { name: 'Title' }), 'Create{Enter}');
    expect(toJSON(doc).flows[0]?.steps[3]).toMatchObject({ title: 'Create' });
  });

  it('shows "Connection deleted" for a broken step', () => {
    setup('broken', 'k2');
    expect(within(inspector()).getByText('Connection deleted')).toBeInTheDocument();
  });

  it('names the branch and marks an error path', () => {
    setup('fork', 'f4b');
    expect(
      within(inspector()).getByRole('heading', { name: 'Step 4b of 5 · Checkout' }),
    ).toBeInTheDocument();
    expect(within(inspector()).getByText('Branch payment failed')).toBeInTheDocument();
    expect(within(inspector()).getByText('· Error path')).toBeInTheDocument();
  });
});

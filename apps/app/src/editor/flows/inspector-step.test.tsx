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
});

import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { playbackDeck } from '../../test/flow-fixtures';
import { announced, renderFlows } from '../../test/render-flows';
import { openFlow } from './flow-mode';

function setup(flowId = 'order', stepId: string | null = null) {
  const view = renderFlows(playbackDeck);
  act(() => {
    openFlow(view.editor(), flowId, stepId);
  });
  return { ...view, player: screen.getByRole('region', { name: 'Step player' }) };
}

describe('StepPlayer', () => {
  it('disables Previous on step 1 and Next on the last step', async () => {
    const { player, user } = setup();
    expect(within(player).getByRole('button', { name: 'Previous step' })).toBeDisabled();
    expect(within(player).getByText('Place order · Step 1 of 8')).toBeInTheDocument();
    expect(within(player).getByText('Submit order')).toBeInTheDocument();
    await user.click(within(player).getByRole('button', { name: 'Next step' }));
    expect(within(player).getByText('Place order · Step 2 of 8')).toBeInTheDocument();
    expect(within(player).getByText('API Gateway → Order Service')).toBeInTheDocument();
    expect(announced()).toBe('Step 2 of 8: API Gateway → Order Service');
    await user.click(within(player).getByRole('button', { name: 'Go to step 8 of 8' }));
    expect(within(player).getByRole('button', { name: 'Next step' })).toBeDisabled();
  });

  it('lists a segment per played step; clicking one makes it current', async () => {
    const { player, user, ui } = setup();
    const progress = within(player).getByRole('list', { name: 'Progress' });
    const segments = within(progress).getAllByRole('button');
    expect(segments).toHaveLength(8);
    expect(segments[0]).toHaveAttribute('aria-current', 'step');
    await user.click(within(progress).getByRole('button', { name: 'Go to step 6 of 8' }));
    expect(ui().activeFlow?.stepId).toBe('o6');
    expect(within(progress).getByRole('button', { name: 'Go to step 6 of 8' })).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('names broken and error-path segments', () => {
    setup('broken');
    expect(
      screen.getByRole('button', { name: 'Go to step 2 of 3, connection deleted' }),
    ).toBeInTheDocument();
  });

  it('shows "No steps" with every control disabled for an empty flow', () => {
    const { player } = setup('empty');
    expect(within(player).getByText('Refund · No steps')).toBeInTheDocument();
    for (const name of ['Previous step', 'Play', 'Next step', 'Speed 1×']) {
      expect(within(player).getByRole('button', { name })).toBeDisabled();
    }
    expect(within(player).queryByRole('list', { name: 'Progress' })).toBeNull();
  });

  it('is not shown outside flow mode', () => {
    renderFlows(playbackDeck);
    expect(screen.queryByRole('region', { name: 'Step player' })).toBeNull();
  });
});

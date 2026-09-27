import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { playbackDeck } from '../../test/flow-fixtures';
import { announced, renderFlows } from '../../test/render-flows';

describe('flow panel in flow mode (007)', () => {
  it('marks the current step row, and a row click makes that step current', async () => {
    const { user, ui } = renderFlows(playbackDeck);
    await user.click(screen.getByRole('button', { name: 'Place order' }));
    const steps = screen.getByRole('list', { name: 'Steps' });
    expect(within(steps).getByRole('button', { name: 'Step 1: Submit order' })).toHaveAttribute(
      'aria-current',
      'step',
    );
    await user.click(within(steps).getByRole('button', { name: /^Step 5:/ }));
    expect(ui().activeFlow).toMatchObject({ stepId: 'o5', playing: false });
    expect(announced()).toBe('Step 5 of 8: Order Service → Payment Service');
    expect(within(steps).getByRole('button', { name: /^Step 5:/ })).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('marks the flow "Last played" after Back to canvas, until another flow opens', async () => {
    const { user } = renderFlows(playbackDeck);
    await user.click(screen.getByRole('button', { name: 'Place order' }));
    await user.click(screen.getByRole('button', { name: 'Back to canvas' }));
    expect(screen.getByText('Last played')).toBeInTheDocument();
    expect(screen.getByTitle('Last played')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: 'Back to canvas' }));
    expect(screen.getAllByText('Last played')).toHaveLength(1);
    const row = screen.getByRole('button', { name: 'Log' }).closest('li');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('Last played')).toBeInTheDocument();
  });
});

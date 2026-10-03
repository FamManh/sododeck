import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { playbackDeck } from '../../test/flow-fixtures';
import { announced, renderFlows } from '../../test/render-flows';
import { openFlow } from './flow-mode';

function setup(stepId: string | null = null) {
  const view = renderFlows(playbackDeck);
  act(() => {
    openFlow(view.editor(), 'fork', stepId);
  });
  const player = () => screen.getByRole('region', { name: 'Step player' });
  const picker = () => within(player()).queryByRole('radiogroup', { name: 'At step 3' });
  return { ...view, player, picker };
}

describe('BranchPicker', () => {
  it('is not shown before the fork', () => {
    const { picker } = setup('f2');
    expect(picker()).toBeNull();
  });

  it('shows one radio per alternative at the fork and on an alternative', () => {
    const { picker, editor } = setup('f3');
    const group = picker();
    expect(group).not.toBeNull();
    if (group === null) return;
    expect(within(group).getByRole('radio', { name: 'payment ok' })).toBeChecked();
    expect(
      within(group).getByRole('radio', { name: 'payment failed, error path' }),
    ).not.toBeChecked();
    act(() => {
      openFlow(editor(), 'fork', 'f5a');
    });
    expect(picker()).not.toBeNull();
  });

  it('switches to the chosen alternative, re-homing the current step and announcing it', async () => {
    const { picker, player, user, ui } = setup('f4a');
    const group = picker();
    if (group === null) throw new Error('no picker');
    await user.click(within(group).getByRole('radio', { name: 'payment failed, error path' }));
    expect(ui().activeFlow).toMatchObject({ alternativeId: 'failed', stepId: 'f4b' });
    expect(within(player()).getByText('Checkout · Step 4b of 5')).toBeInTheDocument();
    const segments = within(within(player()).getByRole('list', { name: 'Progress' })).getAllByRole(
      'button',
    );
    expect(segments.map((s) => s.getAttribute('aria-label'))).toEqual([
      'Go to step 1 of 5',
      'Go to step 2 of 5',
      'Go to step 3 of 5',
      'Go to step 4b of 5, error path',
      'Go to step 5b of 5, error path',
    ]);
    expect(announced()).toBe(
      'Step 4b of 5: Payment Service → Notification Service, branch payment failed',
    );
  });

  describe('Deck look (035)', () => {
    it('gives each alternative an aria-hidden number hint that is not part of its name', () => {
      const { picker } = setup('f3');
      const group = picker();
      if (group === null) throw new Error('no picker');
      const radios = within(group).getAllByRole('radio');
      expect(radios).toHaveLength(2);
      radios.forEach((radio, i) => {
        const hint = radio.querySelector('[data-testid="branch-number-hint"]');
        expect(hint).toHaveAttribute('aria-hidden', 'true');
        expect(hint).toHaveTextContent(String(i + 1));
      });
      expect(within(group).getByRole('radio', { name: 'payment ok' })).toBeInTheDocument();
    });

    it('draws the error alternative with a dashed Clay border and a ⊗ icon, still announced', () => {
      const { picker } = setup('f3');
      const group = picker();
      if (group === null) throw new Error('no picker');
      const error = within(group).getByRole('radio', { name: 'payment failed, error path' });
      expect(error.className).toContain('border-dashed');
      expect(error.className).toContain('border-clay-ink');
      expect(error.querySelector('svg[data-testid="branch-error-icon"]')).not.toBeNull();
      const ok = within(group).getByRole('radio', { name: 'payment ok' });
      expect(ok.className).not.toContain('border-dashed');
    });

    it('adds no number-key shortcut: pressing 2 keeps the alternative', async () => {
      const { picker, user, ui } = setup('f3');
      expect(picker()).not.toBeNull();
      const before = ui().activeFlow;
      await user.keyboard('2');
      expect(ui().activeFlow?.alternativeId).toBe(before?.alternativeId);
      expect(ui().activeFlow?.stepId).toBe(before?.stepId);
    });
  });
});

import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { renderWithEditor } from '../../test/render-canvas';
import { Rail } from './rail';

const rail = () => screen.getByRole('toolbar', { name: 'Canvas tools' });
const button = (name: string | RegExp) => within(rail()).getByRole('button', { name });

describe('Rail Focus (054, FR-004–FR-006)', () => {
  it('sits directly under Select', () => {
    renderWithEditor(<Rail />);
    const names = within(rail())
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));
    expect(names.indexOf('Focus')).toBe(names.indexOf('Select') + 1);
  });

  it('toggles focus mode and shows it as pressed', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Rail />);
    expect(button('Focus')).toHaveAttribute('aria-pressed', 'false');
    await user.click(button('Focus'));
    expect(useUiStore.getState().focusMode).toBe(true);
    expect(button('Focus')).toHaveAttribute('aria-pressed', 'true');
    await user.click(button('Focus'));
    expect(useUiStore.getState().focusMode).toBe(false);
  });

  it('is disabled with its reason while a flow is shown', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Rail />);
    act(() => {
      useUiStore.getState().openFlow('order', 'o1');
    });
    expect(button('Focus')).toHaveAttribute('aria-disabled', 'true');
    const before = useUiStore.getState().focusMode;
    await user.click(button('Focus'));
    expect(useUiStore.getState().focusMode).toBe(before);
    await user.unhover(button('Focus'));
    await user.hover(button('Focus'));
    expect(await screen.findByRole('tooltip', {}, { timeout: 2000 })).toHaveTextContent(
      'Focus: not available while a flow is shown',
    );
  });

  it('explains what Focus does and shows its shortcut', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Rail />);
    await user.hover(button('Focus'));
    expect(await screen.findByRole('tooltip', {}, { timeout: 2000 })).toHaveTextContent(
      /Focus: dim all but the hovered or selected card.*F$/,
    );
  });
});

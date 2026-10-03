import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { ToolsIsland } from './tools-island';

const tools = () => screen.getByRole('toolbar', { name: 'Tools' });
const button = (name: string | RegExp) => within(tools()).getByRole('button', { name });

describe('ToolsIsland (018 FR-011, contract "Tools island")', () => {
  it('opens the command palette from Jump to', async () => {
    const user = userEvent.setup();
    renderWithEditor(<ToolsIsland />);
    await user.click(button(/^Jump to…/));
    expect(useUiStore.getState().palette.open).toBe(true);
  });

  it('toggles Labels', async () => {
    const user = userEvent.setup();
    renderWithEditor(<ToolsIsland />);
    expect(button('Labels')).toHaveAttribute('aria-pressed', 'false');
    await user.click(button('Labels'));
    expect(button('Labels')).toHaveAttribute('aria-pressed', 'true');
    expect(useUiStore.getState().labelsOn).toBe(true);
  });

  it('toggles Focus and disables it while a flow is shown', async () => {
    const user = userEvent.setup();
    renderWithEditor(<ToolsIsland />);
    await user.click(button('Focus'));
    expect(useUiStore.getState().focusMode).toBe(true);
    act(() => {
      useUiStore.getState().openFlow('order', 'o1');
    });
    expect(button('Focus')).toHaveAttribute('aria-disabled', 'true');
    const before = useUiStore.getState().focusMode;
    await user.click(button('Focus'));
    expect(useUiStore.getState().focusMode).toBe(before);
  });

  it('shows only Jump to, Labels and Focus, as icons with names (§g-60)', async () => {
    const user = userEvent.setup();
    renderWithEditor(<ToolsIsland />, deckOf({ name: 'Shop' }));
    expect(
      within(tools())
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual([expect.stringMatching(/^Jump to…/), 'Labels', 'Focus']);
    expect(button('Labels')).not.toHaveTextContent('Labels');
    await user.hover(button('Focus'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      /Focus: dim all but the selection/,
    );
  });
});

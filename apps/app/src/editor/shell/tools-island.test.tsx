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

  it('toggles the deck drawer from Deck settings', async () => {
    const user = userEvent.setup();
    renderWithEditor(<ToolsIsland />);
    expect(button('Deck settings')).toHaveAttribute('aria-pressed', 'false');
    await user.click(button('Deck settings'));
    expect(useUiStore.getState().drawer).toMatchObject({ open: true, mode: 'deck' });
    expect(button('Deck settings')).toHaveAttribute('aria-pressed', 'true');
    await user.click(button('Deck settings'));
    expect(useUiStore.getState().drawer.open).toBe(false);
  });

  it('switches an open details drawer to deck settings instead of closing it', async () => {
    const user = userEvent.setup();
    renderWithEditor(<ToolsIsland />);
    act(() => {
      useUiStore.getState().openDrawer('selection');
    });
    expect(button('Deck settings')).toHaveAttribute('aria-pressed', 'false');
    await user.click(button('Deck settings'));
    expect(useUiStore.getState().drawer).toMatchObject({ open: true, mode: 'deck' });
  });

  it('shows Deck settings, Jump to, Labels and More as icons with names, and no Focus', async () => {
    const user = userEvent.setup();
    renderWithEditor(<ToolsIsland />, deckOf({ name: 'Shop' }));
    expect(
      within(tools())
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Deck settings', expect.stringMatching(/^Jump to…/), 'Labels', 'More']);
    expect(button('Labels')).not.toHaveTextContent('Labels');
    await user.hover(button('Deck settings'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Deck settings');
  });

  it('opens the imports from the More menu, focus returning to More', async () => {
    const user = userEvent.setup();
    renderWithEditor(<ToolsIsland />);
    expect(button('More')).toHaveAttribute('aria-haspopup', 'menu');
    await user.click(button('More'));
    const menu = screen.getByRole('menu', { name: 'More' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Import Mermaid…',
      'Import SQL or DBML…',
      expect.stringMatching(/^Show JSON/),
      'Show DBML / SQL',
    ]);
    await user.click(within(menu).getByRole('menuitem', { name: 'Import Mermaid…' }));
    expect(useUiStore.getState().mermaidDialog).toEqual({
      open: true,
      returnFocus: button('More'),
    });

    await user.click(button('More'));
    await user.click(screen.getByRole('menuitem', { name: 'Import SQL or DBML…' }));
    expect(useUiStore.getState().importDialog).toEqual({ open: true, returnFocus: button('More') });
  });

  it('shows and hides the JSON overlay and the DBML / SQL drawer from the More menu', async () => {
    const user = userEvent.setup();
    renderWithEditor(<ToolsIsland />);
    await user.click(button('More'));
    await user.click(screen.getByRole('menuitem', { name: /Show JSON/ }));
    expect(useUiStore.getState().jsonShown).toBe(true);
    await user.click(button('More'));
    await user.click(screen.getByRole('menuitem', { name: /Hide JSON/ }));
    expect(useUiStore.getState().jsonShown).toBe(false);

    await user.click(button('More'));
    await user.click(screen.getByRole('menuitem', { name: 'Show DBML / SQL' }));
    expect(useUiStore.getState().jsonPanel.codeDrawer.open).toBe(true);
    await user.click(button('More'));
    await user.click(screen.getByRole('menuitem', { name: 'Hide DBML / SQL' }));
    expect(useUiStore.getState().jsonPanel.codeDrawer.open).toBe(false);
  });
});

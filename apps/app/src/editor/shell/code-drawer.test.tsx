import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { CodeDrawer } from './code-drawer';

// The tabs have their own coverage (046); the drawer is about its frame.
vi.mock('../code/dbml-tab', () => ({
  DbmlTab: () => (
    <section role="region" aria-label="DBML schema">
      <textarea aria-label="DBML text" defaultValue="Table t {}" />
    </section>
  ),
}));
vi.mock('../code/sql-tab', () => ({
  SqlTab: () => <section role="region" aria-label="SQL schema" />,
}));

const ui = () => useUiStore.getState();
const drawer = () => screen.queryByRole('complementary', { name: 'Code' });
const setWindow = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
};

function setup(width = 1440) {
  setWindow(width);
  const env = renderWithEditor(<CodeDrawer />, deckOf({ name: 'Shop' }));
  return { ...env, user: userEvent.setup() };
}

afterEach(() => {
  setWindow(1024);
  localStorage.clear();
});

describe('CodeDrawer (054 FR-014–FR-018)', () => {
  it('is absent until opened, then a region named Code with tabs DBML and SQL', async () => {
    setup();
    expect(drawer()).not.toBeInTheDocument();
    act(() => {
      ui().openCodeDrawer();
    });
    const region = drawer();
    expect(region).toBeInTheDocument();
    const tabs = within(region as HTMLElement).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['DBML', 'SQL']);
    expect(await screen.findByRole('region', { name: 'DBML schema' })).toBeInTheDocument();
  });

  it('opens on the tab asked for and switches tabs, remembering the choice', async () => {
    const { user } = setup();
    act(() => {
      ui().openCodeDrawer('sql');
    });
    expect(await screen.findByRole('region', { name: 'SQL schema' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'DBML' }));
    expect(await screen.findByRole('region', { name: 'DBML schema' })).toBeInTheDocument();
    expect(ui().jsonPanel.codeDrawer.format).toBe('dbml');
  });

  it('moves focus to the selected tab on open', async () => {
    setup();
    act(() => {
      ui().openCodeDrawer();
    });
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'DBML' })).toHaveFocus();
    });
  });

  it('closes with the Close button and with Esc, returning focus to the opener', async () => {
    const { user } = setup();
    const opener = document.createElement('button');
    opener.textContent = 'Opener';
    document.body.append(opener);
    opener.focus();
    act(() => {
      ui().openCodeDrawer();
    });
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'DBML' })).toHaveFocus();
    });
    await user.keyboard('{Escape}');
    expect(drawer()).not.toBeInTheDocument();
    await waitFor(() => {
      expect(opener).toHaveFocus();
    });

    opener.focus();
    act(() => {
      ui().openCodeDrawer();
    });
    await user.click(await screen.findByRole('button', { name: 'Close code' }));
    expect(drawer()).not.toBeInTheDocument();
    await waitFor(() => {
      expect(opener).toHaveFocus();
    });
    opener.remove();
  });

  it('leaves Esc to the editor while typing, and closes on the next one', async () => {
    const { user } = setup();
    act(() => {
      ui().openCodeDrawer();
    });
    const field = await screen.findByRole('textbox', { name: 'DBML text' });
    act(() => {
      field.focus();
    });
    await user.keyboard('{Escape}');
    expect(drawer()).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(drawer()).not.toBeInTheDocument();
  });

  describe('the grip', () => {
    const open = async () => {
      const env = setup();
      act(() => {
        ui().openCodeDrawer();
      });
      // Opening moves focus to the tab on the next frame; wait so it cannot steal it back.
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'DBML' })).toHaveFocus();
      });
      const grip = screen.getByRole('separator', { name: 'Resize code' });
      return { ...env, grip };
    };

    it('is a separator with 320, the clamp maximum and the current width', async () => {
      const { grip } = await open();
      expect(grip).toHaveAttribute('aria-orientation', 'vertical');
      expect(grip).toHaveAttribute('aria-valuemin', '320');
      // 70 % of 1440 with no details drawer.
      expect(grip).toHaveAttribute('aria-valuemax', '1007');
      expect(grip).toHaveAttribute('aria-valuenow', '560');
    });

    it('resizes by 8 with arrows, by 40 with ⇧, and jumps with Home and End', async () => {
      const { user, grip } = await open();
      act(() => {
        grip.focus();
      });
      await user.keyboard('{ArrowLeft}');
      expect(grip).toHaveAttribute('aria-valuenow', '568');
      await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
      expect(grip).toHaveAttribute('aria-valuenow', '528');
      await user.keyboard('{End}');
      expect(grip).toHaveAttribute('aria-valuenow', '1007');
      await user.keyboard('{Home}');
      expect(grip).toHaveAttribute('aria-valuenow', '320');
      expect(JSON.parse(localStorage.getItem('sododeck.jsonPanel') ?? '{}')).toMatchObject({
        codeDrawer: { width: 320 },
      });
    });

    it('follows a drag live and saves once, on release', async () => {
      const { grip } = await open();
      fireEvent.pointerDown(grip, { clientX: 800, pointerId: 1 });
      fireEvent.pointerMove(grip, { clientX: 500, pointerId: 1 });
      expect(grip).toHaveAttribute('aria-valuenow', '860');
      expect(localStorage.getItem('sododeck.jsonPanel')).not.toContain('"width":860');
      fireEvent.pointerUp(grip, { clientX: 500, pointerId: 1 });
      expect(JSON.parse(localStorage.getItem('sododeck.jsonPanel') ?? '{}')).toMatchObject({
        codeDrawer: { width: 860 },
      });
    });
  });

  it('sits left of the details drawer when both are open, and never past the canvas strip', () => {
    setup(1440);
    act(() => {
      ui().openDrawer('deck');
      ui().openCodeDrawer();
      ui().setCodeDrawerWidth(1200);
    });
    const aside = drawer();
    expect(aside).toHaveStyle({ right: '384px' });
    // 1440 - 68 - 360 - 24 - 240
    expect(aside).toHaveStyle({ width: '748px' });
  });

  it('closes itself when the details drawer opens in a window with no room for both', () => {
    setup(900);
    act(() => {
      ui().openCodeDrawer();
    });
    expect(drawer()).toBeInTheDocument();
    act(() => {
      ui().openDrawer('deck');
    });
    expect(drawer()).not.toBeInTheDocument();
  });
});

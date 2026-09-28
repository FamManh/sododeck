import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { useSaveStatusStore } from '../../storage/save-status';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { Canvas } from '../canvas';
import { SaveContext } from '../save-context';
import { useEditorShortcuts } from '../use-canvas-shortcuts';
import { CanvasShell } from './canvas-shell';
import { ShellChrome } from './shell-chrome';
import { loadShellPrefs } from './shell-prefs';

// Monaco does not run in jsdom; the JSON panel has its own coverage (004).
vi.mock('../json-viewer', () => ({ default: () => <p>viewer</p> }));

function Editor() {
  useEditorShortcuts();
  const deck = useDeckSnapshot(useEditor().doc);
  return (
    <MemoryRouter>
      <CanvasShell canvas={<Canvas />}>
        <ShellChrome deck={deck} />
      </CanvasShell>
    </MemoryRouter>
  );
}

const shop = deckOf({
  name: 'Shop',
  nodes: [
    { id: 'a', type: 'service', title: 'Orders', position: { x: 0, y: 0 } },
    { id: 'b', type: 'database', title: 'Stock', position: { x: 300, y: 0 } },
  ],
});

const ui = () => useUiStore.getState();

function setup(stored = false) {
  const env = renderWithEditor(
    stored ? (
      <SaveContext
        value={{ mode: 'stored', flush: () => Promise.resolve(), markExported: () => {} }}
      >
        <Editor />
      </SaveContext>
    ) : (
      <Editor />
    ),
    shop,
  );
  act(() => {
    ui().resetForDeck('deck-1');
  });
  return { ...env, user: userEvent.setup() };
}

const region = (name: string) => screen.queryByRole('toolbar', { name });
const json = () => screen.queryByRole('region', { name: 'JSON' });

describe('JSON overlay (018 US4)', () => {
  it('is hidden by default; ⌘J shows it with focus inside, and remembers it per deck', async () => {
    localStorage.clear();
    const { user } = setup();
    expect(json()).not.toBeInTheDocument();
    await user.keyboard('{Meta>}j{/Meta}');
    expect(json()).toBeInTheDocument();
    expect(loadShellPrefs('deck-1').jsonOpen).toBe(true);
    await vi.waitFor(() => {
      expect(json()).toContainElement(document.activeElement as HTMLElement);
    });
    await user.keyboard('{Meta>}j{/Meta}');
    expect(json()).not.toBeInTheDocument();
    localStorage.clear();
  });

  it('gives focus back to the canvas on Esc and stays open; × closes it', async () => {
    const { user } = setup();
    act(() => {
      ui().setJsonShown(true);
    });
    act(() => {
      within(json() ?? document.body)
        .getAllByRole('button')[0]
        ?.focus();
    });
    await user.keyboard('{Escape}');
    expect(json()).toBeInTheDocument();
    expect(
      screen.getByLabelText('Diagram canvas').closest('[data-region="canvas"]'),
    ).toContainElement(document.activeElement as HTMLElement);
    await user.click(screen.getByRole('button', { name: 'Close JSON' }));
    expect(json()).not.toBeInTheDocument();
    localStorage.clear();
  });

  it('moves the zoom island above it', () => {
    setup();
    const zoom = () => region('Zoom');
    expect(zoom()).toHaveStyle({ bottom: '12px' });
    act(() => {
      ui().setJsonShown(true);
    });
    expect(zoom()).not.toHaveStyle({ bottom: '12px' });
    localStorage.clear();
  });
});

describe('Hide UI (018 US5)', () => {
  it('leaves only "Show UI", keeps canvas keys, and restores what was open', async () => {
    const { user } = setup();
    act(() => {
      ui().openFlyout('outline');
      ui().select({ nodes: ['a'] });
      ui().openDrawer();
    });
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: '\\',
      code: 'Backslash',
      metaKey: true,
    });
    for (const name of ['Deck', 'Tools', 'Canvas tools', 'History', 'Zoom']) {
      expect(region(name)).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('dialog', { name: 'Outline' })).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Details' })).not.toBeInTheDocument();
    expect(ui().announcement.text).toBe('Interface hidden');

    // Canvas keys keep working: Delete asks for confirmation.
    act(() => {
      document.querySelector<HTMLElement>('[data-node-id="a"]')?.focus();
    });
    await user.keyboard('{Delete}');
    expect(ui().pendingDelete).not.toBeNull();
    act(() => {
      ui().cancelDelete();
    });

    await user.click(screen.getByRole('button', { name: 'Show UI' }));
    expect(region('Deck')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Outline' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Details' })).toBeInTheDocument();
  });

  it('marks the Show UI pill when saving fails while hidden', () => {
    useSaveStatusStore.getState().reset();
    setup(true);
    act(() => {
      ui().setHideUi(true);
      useSaveStatusStore
        .getState()
        .dispatch({ type: 'failed', firstUnsavedAt: Date.now(), errorName: 'QuotaExceededError' });
    });
    expect(screen.getByRole('button', { name: "Show UI, couldn't save" })).toBeInTheDocument();
  });
});

describe('Keyboard regions (018 US6)', () => {
  const activeRegion = () =>
    document.activeElement?.closest('[data-region]')?.getAttribute('data-region');

  it('cycles regions with F6 / ⇧F6, the drawer only when open', async () => {
    const { user } = setup();
    act(() => {
      screen.getByLabelText('Diagram canvas').closest<HTMLElement>('[data-region]')?.focus();
    });
    const order: string[] = [];
    for (let i = 0; i < 6; i++) {
      await user.keyboard('{F6}');
      order.push(activeRegion() ?? '');
    }
    expect(order).toEqual(['zoom', 'deck', 'tools', 'rail', 'history', 'canvas']);

    act(() => {
      ui().select({ nodes: ['a'] });
      ui().openDrawer();
    });
    // Opening the drawer moves focus into it (its title).
    await vi.waitFor(() => {
      expect(activeRegion()).toBe('drawer');
    });
    await user.keyboard('{Shift>}{F6}{/Shift}');
    expect(activeRegion()).toBe('zoom');
    await user.keyboard('{F6}');
    expect(activeRegion()).toBe('drawer');
    await user.keyboard('{F6}');
    expect(activeRegion()).toBe('deck');
  });

  it('opens the shortcut list with ? and the zoom island button', async () => {
    const { user } = setup();
    act(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    await user.keyboard('?');
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    for (const section of ['Tools', 'Panels', 'Canvas', 'Flows', 'JSON']) {
      expect(within(dialog).getByRole('heading', { name: section })).toBeInTheDocument();
    }
    for (const action of ['Next region', 'Hide UI', 'Show or hide JSON', 'Details drawer']) {
      expect(within(dialog).getByRole('cell', { name: action })).toBeInTheDocument();
    }
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
  });
});

describe('Zoom island (FR-033)', () => {
  it('names its controls and toggles the minimap with M', async () => {
    const { user } = setup();
    const zoom = region('Zoom');
    if (zoom === null) throw new Error('no zoom island');
    for (const name of ['Fit diagram', 'Fit selection', 'Zoom out', 'Zoom in', 'Minimap']) {
      expect(within(zoom).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(within(zoom).getByRole('button', { name: 'Fit selection' })).toBeDisabled();
    act(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    await user.keyboard('m');
    expect(within(zoom).getByRole('button', { name: 'Minimap' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(document.querySelector('.react-flow__minimap')).not.toBeNull();
  });

  it('mounts the Export dialog while the store asks for it (012)', async () => {
    setup();
    expect(screen.queryByRole('dialog', { name: 'Export deck' })).not.toBeInTheDocument();
    act(() => {
      ui().openExport(null);
    });
    expect(await screen.findByRole('dialog', { name: 'Export deck' })).toBeInTheDocument();
    act(() => {
      ui().closeExport();
    });
    expect(screen.queryByRole('dialog', { name: 'Export deck' })).not.toBeInTheDocument();
  });
});

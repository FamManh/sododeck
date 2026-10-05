import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadShellPrefs, saveShellPrefs } from '../editor/shell/shell-prefs';
import { openedFlow, useUiStore } from './ui-store';

const initial = useUiStore.getState();
const ui = () => useUiStore.getState();

beforeEach(() => {
  useUiStore.setState(initial, true);
  localStorage.clear();
  ui().resetForDeck('deck-1');
});

afterEach(() => {
  localStorage.clear();
});

describe('flyouts (018 data-model transitions)', () => {
  it('opens one flyout at a time and toggles the one shown', () => {
    ui().openFlyout('outline');
    expect(ui().flyout).toBe('outline');
    ui().openFlyout('flows');
    expect(ui().flyout).toBe('flows');
    ui().openFlyout('flows');
    expect(ui().flyout).toBeNull();
  });

  it('dismisses an unpinned flyout on an outside click or Esc', () => {
    ui().openFlyout('outline');
    ui().dismissFlyout();
    expect(ui().flyout).toBeNull();
  });

  it('keeps a pinned flyout on dismiss', () => {
    ui().openFlyout('outline');
    ui().togglePin();
    ui().dismissFlyout();
    expect(ui().flyout).toBe('outline');
    expect(ui().pinnedFlyout).toBe('outline');
  });

  it('returns the pinned flyout when a temporary one closes', () => {
    ui().openFlyout('outline');
    ui().togglePin();
    ui().openFlyout('palette');
    expect(ui().flyout).toBe('palette');
    ui().closeFlyout();
    expect(ui().flyout).toBe('outline');
    ui().openFlyout('palette');
    ui().dismissFlyout();
    expect(ui().flyout).toBe('outline');
  });

  it('closing the pinned flyout itself unpins it', () => {
    ui().openFlyout('outline');
    ui().togglePin();
    ui().closeFlyout();
    expect(ui().flyout).toBeNull();
    expect(ui().pinnedFlyout).toBeNull();
  });

  it('toggling the pinned one from the rail closes and unpins it', () => {
    ui().openFlyout('outline');
    ui().togglePin();
    ui().openFlyout('outline');
    expect(ui().flyout).toBeNull();
    expect(ui().pinnedFlyout).toBeNull();
  });

  it('saves the pin for this deck only', () => {
    ui().openFlyout('flows');
    ui().togglePin();
    expect(loadShellPrefs('deck-1').pinnedFlyout).toBe('flows');
    expect(loadShellPrefs('deck-2').pinnedFlyout).toBeNull();
    ui().togglePin();
    expect(loadShellPrefs('deck-1').pinnedFlyout).toBeNull();
  });

  it('pins the flows flyout during a session and restores the previous pin', () => {
    ui().openFlyout('outline');
    ui().togglePin();
    ui().pinForSession();
    expect(ui().flyout).toBe('flows');
    expect(ui().pinnedFlyout).toBe('flows');
    // The session pin is never saved.
    expect(loadShellPrefs('deck-1').pinnedFlyout).toBe('outline');
    ui().restoreAfterSession();
    expect(ui().flyout).toBe('outline');
    expect(ui().pinnedFlyout).toBe('outline');
  });
});

describe('detail drawer', () => {
  it('opens in selection mode with a selection and remembers the focused card', () => {
    ui().select({ nodes: ['n1'] });
    ui().focus('n1');
    ui().openDrawer();
    expect(ui().drawer).toMatchObject({ open: true, mode: 'selection' });
    expect(ui().drawerReturn).toBe('n1');
  });

  it('opens on the deck when nothing is selected', () => {
    ui().openDrawer();
    expect(ui().drawer.mode).toBe('deck');
  });

  it('closes when the selection becomes empty, but not in deck mode', () => {
    ui().select({ nodes: ['n1'] });
    ui().openDrawer();
    ui().clearSelection();
    expect(ui().drawer.open).toBe(false);

    ui().openDrawer('deck');
    ui().select({ nodes: ['n1'] });
    ui().clearSelection();
    expect(ui().drawer.open).toBe(true);
  });

  it('stays open on a flow with no canvas selection', () => {
    ui().select({ nodes: ['n1'] });
    ui().openDrawer();
    useUiStore.setState({ activeFlow: openedFlow('f1'), selection: initial.selection });
    expect(ui().drawer.open).toBe(true);
  });

  it('closes when a pruned selection disappears', () => {
    ui().select({ nodes: ['n1'] });
    ui().openDrawer();
    ui().pruneSelection({
      nodes: new Set(),
      edges: new Set(),
      groups: new Set(),
      stickies: new Set(),
      images: new Set(),
    });
    expect(ui().drawer.open).toBe(false);
  });

  it('toggles', () => {
    ui().select({ nodes: ['n1'] });
    ui().toggleDrawer();
    expect(ui().drawer.open).toBe(true);
    ui().toggleDrawer();
    expect(ui().drawer).toMatchObject({ open: false, mode: 'selection' });
  });

  it('clamps the width and saves it once, on commit', () => {
    ui().setDrawerWidth(900);
    expect(ui().drawer.width).toBe(560);
    expect(loadShellPrefs('deck-1').drawerWidth).toBe(360);
    ui().setDrawerWidth(420, { commit: true });
    expect(loadShellPrefs('deck-1').drawerWidth).toBe(420);
  });
});

describe('JSON, Hide UI and per-deck reset', () => {
  it('hides the JSON overlay by default and saves it per deck (FR-028, FR-032)', () => {
    expect(ui().jsonShown).toBe(false);
    ui().toggleJsonShown();
    expect(ui().jsonShown).toBe(true);
    expect(loadShellPrefs('deck-1').jsonOpen).toBe(true);
    ui().resetForDeck('deck-2');
    expect(ui().jsonShown).toBe(false);
    ui().resetForDeck('deck-1');
    expect(ui().jsonShown).toBe(true);
  });

  it('keeps 004’s expanded / collapsed state separate from being shown', () => {
    ui().setJsonShown(true);
    ui().setJsonPanelOpen(false);
    expect(ui().jsonShown).toBe(true);
    expect(loadShellPrefs('deck-1').jsonOpen).toBe(true);
  });

  it('keeps every other shell field while the UI is hidden', () => {
    ui().openFlyout('outline');
    ui().select({ nodes: ['n1'] });
    ui().openDrawer();
    ui().setHideUi(true);
    expect(ui()).toMatchObject({ hideUi: true, flyout: 'outline', drawer: { open: true } });
    ui().setHideUi(false);
    expect(ui()).toMatchObject({ hideUi: false, flyout: 'outline', drawer: { open: true } });
  });

  it('reads the deck’s preferences and resets session-only fields', () => {
    saveShellPrefs('deck-3', { drawerWidth: 500, pinnedFlyout: 'rules', jsonOpen: true });
    ui().setHideUi(true);
    ui().setMinimap(true);
    ui().setTool('sticky');
    ui().setHelpOpen(true);
    ui().resetForDeck('deck-3');
    expect(ui()).toMatchObject({
      flyout: 'rules',
      pinnedFlyout: 'rules',
      drawer: { open: false, width: 500, mode: 'selection' },
      hideUi: false,
      minimap: false,
      tool: 'select',
      helpOpen: false,
      jsonShown: true,
    });
  });

  it('uses defaults and saves nothing for a deck without an id', () => {
    ui().resetForDeck(null);
    ui().toggleJsonShown();
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
    expect(keys.some((key) => key?.startsWith('sododeck.shell.'))).toBe(false);
  });
});

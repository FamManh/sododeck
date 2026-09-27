import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JSON_PANEL_KEY } from './json-panel-prefs';
import { LABELS_KEY, readLabelsOn, useUiStore } from './ui-store';

const initial = useUiStore.getState();
const state = () => useUiStore.getState();

describe('ui store', () => {
  beforeEach(() => {
    useUiStore.setState(initial, true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('selects, toggles and clears nodes and edges', () => {
    state().select({ nodes: ['a'] });
    expect(state().selection).toEqual({ nodes: ['a'], edges: [] });
    state().toggle('b', 'node');
    state().toggle('e1', 'edge');
    expect(state().selection).toEqual({ nodes: ['a', 'b'], edges: ['e1'] });
    state().toggle('a', 'node');
    expect(state().selection).toEqual({ nodes: ['b'], edges: ['e1'] });
    state().clearSelection();
    expect(state().selection).toEqual({ nodes: [], edges: [] });
  });

  it('prunes ids that no longer exist, and keeps the same object when nothing is pruned', () => {
    state().select({ nodes: ['a', 'gone'], edges: ['e1'] });
    state().pruneSelection({ nodes: new Set(['a']), edges: new Set(['e1']) });
    expect(state().selection).toEqual({ nodes: ['a'], edges: ['e1'] });
    const kept = state().selection;
    state().pruneSelection({ nodes: new Set(['a']), edges: new Set(['e1']) });
    expect(state().selection).toBe(kept);
  });

  it('prunes the focused node and edge, and closes a popover whose object is gone', () => {
    state().focus('a');
    state().focusEdge('e1');
    state().openEdgePopover('e1');
    state().pruneSelection({ nodes: new Set(), edges: new Set() });
    expect(state().focusedId).toBeNull();
    expect(state().focusedEdgeId).toBeNull();
    expect(state().popover).toBeNull();
    state().openConnectPopover('a');
    state().pruneSelection({ nodes: new Set(), edges: new Set() });
    expect(state().popover).toBeNull();
  });

  it('tracks focus', () => {
    state().focus('a');
    expect(state().focusedId).toBe('a');
    state().focusEdge('e1');
    expect(state().focusedEdgeId).toBe('e1');
    state().focus('b');
    expect(state().focusedEdgeId).toBeNull();
  });

  it('switches the left tab and collapses outline groups', () => {
    expect(state().leftTab).toBe('outline');
    state().setLeftTab('palette');
    expect(state().leftTab).toBe('palette');
    state().toggleOutlineGroup('g');
    expect(state().outlineCollapsed.has('g')).toBe(true);
    state().toggleOutlineGroup('g');
    expect(state().outlineCollapsed.has('g')).toBe(false);
  });

  it('remembers Labels in localStorage', () => {
    state().setLabelsOn(true);
    expect(state().labelsOn).toBe(true);
    expect(localStorage.getItem(LABELS_KEY)).toBe('on');
    expect(readLabelsOn()).toBe(true);
    state().setLabelsOn(false);
    expect(readLabelsOn()).toBe(false);
  });

  it('works when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readLabelsOn()).toBe(false);
    state().setLabelsOn(true);
    expect(state().labelsOn).toBe(true);
  });

  it('opens and closes popovers', () => {
    state().openEdgePopover('e1');
    expect(state().popover).toEqual({ kind: 'edge', edgeId: 'e1' });
    state().openConnectPopover('a');
    expect(state().popover).toEqual({ kind: 'connect', fromId: 'a' });
    state().closePopover();
    expect(state().popover).toBeNull();
  });

  it('requests and cancels a delete', () => {
    state().requestDelete({ nodes: ['a'], edges: [] });
    expect(state().pendingDelete).toEqual({ nodes: ['a'], edges: [] });
    state().cancelDelete();
    expect(state().pendingDelete).toBeNull();
  });

  it('announces, counting repeats', () => {
    state().announce('Added New service');
    const first = state().announcement;
    state().announce('Added New service');
    expect(state().announcement.text).toBe('Added New service');
    expect(state().announcement.seq).toBe(first.seq + 1);
  });

  it('starts the JSON panel open on the Deck tab (clarification Q3)', () => {
    expect(state().jsonPanel).toEqual({ open: true, height: 212, tab: 'deck' });
  });

  it('updates and saves each JSON panel preference', () => {
    const saved = () => JSON.parse(localStorage.getItem(JSON_PANEL_KEY) ?? 'null') as unknown;
    state().setJsonPanelOpen(false);
    expect(state().jsonPanel.open).toBe(false);
    expect(saved()).toEqual({ open: false, height: 212, tab: 'deck' });
    state().setJsonPanelHeight(320);
    expect(state().jsonPanel.height).toBe(320);
    expect(saved()).toEqual({ open: false, height: 320, tab: 'deck' });
    state().setJsonTab('selection');
    expect(state().jsonPanel.tab).toBe('selection');
    expect(saved()).toEqual({ open: false, height: 320, tab: 'selection' });
    state().toggleJsonPanel();
    expect(state().jsonPanel.open).toBe(true);
    expect(saved()).toEqual({ open: true, height: 320, tab: 'selection' });
  });

  it('never switches the JSON tab when the selection changes (clarification Q2)', () => {
    state().select({ nodes: ['a'], edges: ['e1'] });
    expect(state().jsonPanel.tab).toBe('deck');
    state().setJsonTab('selection');
    state().clearSelection();
    state().toggle('b', 'node');
    state().pruneSelection({ nodes: new Set(), edges: new Set() });
    expect(state().jsonPanel.tab).toBe('selection');
  });

  it('forgets deck references when another deck opens', () => {
    state().select({ nodes: ['a'] });
    state().focus('a');
    state().openEdgePopover('e');
    state().requestDelete({ nodes: ['a'], edges: [] });
    state().setLabelsOn(true);
    state().resetForDeck();
    expect(state()).toMatchObject({
      selection: { nodes: [], edges: [] },
      focusedId: null,
      popover: null,
      pendingDelete: null,
      labelsOn: true,
    });
  });
});

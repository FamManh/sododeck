import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openedFlow, useUiStore, type MenuTarget } from './ui-store';

const initial = useUiStore.getState();
const state = () => useUiStore.getState();

const existing = (ids: { nodes?: string[]; edges?: string[]; groups?: string[] }) => ({
  nodes: new Set(ids.nodes ?? []),
  edges: new Set(ids.edges ?? []),
  groups: new Set(ids.groups ?? []),
  stickies: new Set<string>(),
  images: new Set<string>(),
});

const componentMenu: MenuTarget = {
  kind: 'component',
  ids: { nodes: ['n1'], edges: [], groups: [], stickies: [], images: [] },
};

describe('ui store: quick edit (019)', () => {
  beforeEach(() => {
    useUiStore.setState(initial, true);
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('starts and ends a title edit, closing the menu and the toolbar field', () => {
    state().openContextMenu({ target: componentMenu, point: { x: 1, y: 2 }, via: 'pointer' });
    state().openToolbarField('owner');
    state().startTitleEdit({ target: 'node', id: 'n1', isNew: false });
    expect(state().titleEdit).toEqual({ target: 'node', id: 'n1', isNew: false });
    expect(state().contextMenu).toBeNull();
    expect(state().toolbarField).toBeNull();
    state().endTitleEdit();
    expect(state().titleEdit).toBeNull();
  });

  it('refuses a title edit in flow mode and during a session (FR-010)', () => {
    useUiStore.setState({ activeFlow: openedFlow('f1') });
    expect(state().startTitleEdit({ target: 'node', id: 'n1', isNew: false })).toBe(false);
    expect(state().titleEdit).toBeNull();

    useUiStore.setState(initial, true);
    state().startRecording('New flow', null);
    expect(state().startTitleEdit({ target: 'group', id: 'g1', isNew: false })).toBe(false);
    expect(state().titleEdit).toBeNull();

    useUiStore.setState(initial, true);
    expect(state().startTitleEdit({ target: 'group', id: 'g1', isNew: false })).toBe(true);
  });

  it('opens and closes the context menu with its return focus', () => {
    const button = document.createElement('button');
    state().openContextMenu({
      target: { kind: 'canvas' },
      point: { x: 10, y: 20 },
      via: 'keyboard',
      returnFocus: button,
    });
    expect(state().contextMenu).toEqual({
      target: { kind: 'canvas' },
      point: { x: 10, y: 20 },
      via: 'keyboard',
      returnFocus: button,
    });
    state().closeContextMenu();
    expect(state().contextMenu).toBeNull();
  });

  it('closes the toolbar field when a gesture starts, and remembers the gesture', () => {
    state().openToolbarField('tags');
    expect(state().toolbarField).toBe('tags');
    state().setCanvasGesture('pan');
    expect(state().canvasGesture).toBe('pan');
    expect(state().toolbarField).toBeNull();
    state().setCanvasGesture(null);
    expect(state().canvasGesture).toBeNull();
    state().openToolbarField('type');
    state().closeToolbarField();
    expect(state().toolbarField).toBeNull();
  });

  it('prunes a title edit and a menu whose objects are gone', () => {
    state().startTitleEdit({ target: 'group', id: 'g1', isNew: false });
    state().openContextMenu({ target: componentMenu, point: { x: 0, y: 0 }, via: 'pointer' });
    state().pruneSelection(existing({ nodes: ['n1'], groups: ['g1'] }));
    expect(state().titleEdit).not.toBeNull();
    expect(state().contextMenu).not.toBeNull();

    state().pruneSelection(existing({ nodes: [], groups: [] }));
    expect(state().titleEdit).toBeNull();
    expect(state().contextMenu).toBeNull();
  });

  it('keeps a canvas menu when objects are removed', () => {
    state().openContextMenu({ target: { kind: 'canvas' }, point: { x: 0, y: 0 }, via: 'pointer' });
    state().pruneSelection(existing({}));
    expect(state().contextMenu).not.toBeNull();
  });

  it('forgets all four for another deck', () => {
    state().startTitleEdit({ target: 'node', id: 'n1', isNew: true, kind: 'service' });
    useUiStore.setState({
      contextMenu: {
        target: { kind: 'canvas' },
        point: { x: 0, y: 0 },
        via: 'pointer',
        returnFocus: null,
      },
      toolbarField: 'owner',
      canvasGesture: 'drag',
    });
    state().resetForDeck();
    expect(state().titleEdit).toBeNull();
    expect(state().contextMenu).toBeNull();
    expect(state().toolbarField).toBeNull();
    expect(state().canvasGesture).toBeNull();
  });
});

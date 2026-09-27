import { beforeEach, describe, expect, it } from 'vitest';

import { resetLibraryStore, useLibraryStore } from './library-store';

const store = () => useLibraryStore.getState();

beforeEach(() => {
  localStorage.clear();
  resetLibraryStore();
});

describe('library store', () => {
  it('starts on All decks in the grid', () => {
    expect(store().section).toBe('all');
    expect(store().viewMode).toBe('grid');
  });

  it('remembers the view mode in localStorage', () => {
    store().setViewMode('list');
    expect(localStorage.getItem('sododeck.library.view')).toBe('list');
    resetLibraryStore();
    expect(store().viewMode).toBe('list');
  });

  it('keeps an undo stack for the session', () => {
    store().pushUndo({ kind: 'deck', id: 'a', name: 'A' });
    store().pushUndo({ kind: 'folder', id: 'f', name: 'F', deckIds: ['b'] });
    expect(store().popUndo()).toMatchObject({ kind: 'folder', id: 'f' });
    expect(store().popUndo()).toMatchObject({ kind: 'deck', id: 'a' });
    expect(store().popUndo()).toBeUndefined();
  });

  it('sets section, search and renaming', () => {
    store().setSection('folder:x');
    store().setSearch('pay');
    store().setRenaming('a');
    expect(store()).toMatchObject({ section: 'folder:x', search: 'pay', renamingId: 'a' });
  });
});

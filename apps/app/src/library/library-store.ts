import { create } from 'zustand';

import type { LibrarySection } from './library-view';

export type ViewMode = 'grid' | 'list';

/** A library delete that can still be undone in this session (research R8). */
export type UndoEntry =
  | { kind: 'deck'; id: string; name: string }
  | { kind: 'folder'; id: string; name: string; deckIds: string[] };

/** A delete waiting for confirmation in the dialog. */
export type PendingDelete =
  | { kind: 'deck'; id: string; name: string }
  | { kind: 'folder'; id: string; name: string; deckCount: number };

const VIEW_KEY = 'sododeck.library.view';

function readViewMode(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid'; // storage blocked: the default, not an error
  }
}

interface LibraryStore {
  section: LibrarySection;
  search: string;
  viewMode: ViewMode;
  /** The deck or folder whose name is being edited inline. */
  renamingId: string | null;
  pendingDelete: PendingDelete | null;
  undoStack: UndoEntry[];
  setSection: (section: LibrarySection) => void;
  setSearch: (search: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setRenaming: (id: string | null) => void;
  requestDelete: (pending: PendingDelete | null) => void;
  pushUndo: (entry: UndoEntry) => void;
  popUndo: () => UndoEntry | undefined;
}

/** UI-only library state. Nothing here is document data. */
export const useLibraryStore = create<LibraryStore>()((set, get) => ({
  section: 'all',
  search: '',
  viewMode: readViewMode(),
  renamingId: null,
  pendingDelete: null,
  undoStack: [],
  setSection: (section) => {
    set({ section });
  },
  setSearch: (search) => {
    set({ search });
  },
  setViewMode: (viewMode) => {
    set({ viewMode });
    try {
      localStorage.setItem(VIEW_KEY, viewMode);
    } catch {
      // Not remembered in this browser; the choice still applies now.
    }
  },
  setRenaming: (renamingId) => {
    set({ renamingId });
  },
  requestDelete: (pendingDelete) => {
    set({ pendingDelete });
  },
  pushUndo: (entry) => {
    set({ undoStack: [...get().undoStack, entry] });
  },
  popUndo: () => {
    const stack = get().undoStack;
    const entry = stack.at(-1);
    if (entry) set({ undoStack: stack.slice(0, -1) });
    return entry;
  },
}));

/** For tests: back to a fresh session (the view mode is re-read from localStorage). */
export function resetLibraryStore(): void {
  useLibraryStore.setState({
    section: 'all',
    search: '',
    viewMode: readViewMode(),
    renamingId: null,
    pendingDelete: null,
    undoStack: [],
  });
}

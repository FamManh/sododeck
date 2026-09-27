import { create } from 'zustand';

/**
 * UI-only state: selection, panels, modes. NEVER document data —
 * that lives in the Yjs document (@sododeck/model).
 */
export interface UiState {
  selectedId: string | null;
  jsonPanelOpen: boolean;
  select: (id: string | null) => void;
  toggleJsonPanel: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  selectedId: null,
  jsonPanelOpen: true,
  select: (id) => {
    set({ selectedId: id });
  },
  toggleJsonPanel: () => {
    set((state) => ({ jsonPanelOpen: !state.jsonPanelOpen }));
  },
}));

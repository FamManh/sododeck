import { create } from 'zustand';

/**
 * UI-only state: selection, focus, panels, popovers, preferences. NEVER document data —
 * that lives in the Yjs document (@sododeck/model). Ids here are references into the deck; they
 * are pruned when the objects disappear.
 */
export interface Selection {
  readonly nodes: readonly string[];
  readonly edges: readonly string[];
}

export type Popover = { kind: 'edge'; edgeId: string } | { kind: 'connect'; fromId: string } | null;

export type LeftTab = 'outline' | 'palette';

export interface UiState {
  selection: Selection;
  /** Roving-tabindex target on the canvas (US6). */
  focusedId: string | null;
  /** Connection reached with E from the focused node. */
  focusedEdgeId: string | null;
  leftTab: LeftTab;
  outlineCollapsed: ReadonlySet<string>;
  labelsOn: boolean;
  popover: Popover;
  /** The selection the delete confirmation is open for. */
  pendingDelete: Selection | null;
  /** Live-region text; `seq` changes on every call so repeats are announced again. */
  announcement: { text: string; seq: number };
  jsonPanelOpen: boolean;

  select: (selection: Partial<Selection>) => void;
  toggle: (id: string, type: 'node' | 'edge') => void;
  clearSelection: () => void;
  /** Drops every id that is not in the deck any more (after any document change). */
  pruneSelection: (existing: { nodes: ReadonlySet<string>; edges: ReadonlySet<string> }) => void;
  focus: (id: string | null) => void;
  focusEdge: (id: string | null) => void;
  setLeftTab: (tab: LeftTab) => void;
  toggleOutlineGroup: (groupId: string) => void;
  setLabelsOn: (on: boolean) => void;
  openEdgePopover: (edgeId: string) => void;
  openConnectPopover: (fromId: string) => void;
  closePopover: () => void;
  requestDelete: (selection: Selection) => void;
  cancelDelete: () => void;
  announce: (text: string) => void;
  toggleJsonPanel: () => void;
  /** Forgets everything that pointed into the previous deck (opening another one). */
  resetForDeck: () => void;
}

export const EMPTY_SELECTION: Selection = { nodes: [], edges: [] };

export const LABELS_KEY = 'sododeck.labels';

export function readLabelsOn(): boolean {
  try {
    return localStorage.getItem(LABELS_KEY) === 'on';
  } catch {
    return false; // storage can be blocked (private mode, policies)
  }
}

function writeLabelsOn(on: boolean): void {
  try {
    localStorage.setItem(LABELS_KEY, on ? 'on' : 'off');
  } catch {
    // non-critical preference
  }
}

const without = (ids: readonly string[], id: string) => ids.filter((x) => x !== id);

export const useUiStore = create<UiState>()((set) => ({
  selection: EMPTY_SELECTION,
  focusedId: null,
  focusedEdgeId: null,
  leftTab: 'outline',
  outlineCollapsed: new Set(),
  labelsOn: readLabelsOn(),
  popover: null,
  pendingDelete: null,
  announcement: { text: '', seq: 0 },
  jsonPanelOpen: true,

  select: ({ nodes = [], edges = [] }) => {
    set({
      selection: nodes.length === 0 && edges.length === 0 ? EMPTY_SELECTION : { nodes, edges },
    });
  },
  toggle: (id, type) => {
    set(({ selection }) => {
      const key = type === 'node' ? 'nodes' : 'edges';
      const list = selection[key];
      return {
        selection: {
          ...selection,
          [key]: list.includes(id) ? without(list, id) : [...list, id],
        },
      };
    });
  },
  clearSelection: () => {
    set({ selection: EMPTY_SELECTION });
  },
  pruneSelection: (existing) => {
    set((state) => {
      const nodes = state.selection.nodes.filter((id) => existing.nodes.has(id));
      const edges = state.selection.edges.filter((id) => existing.edges.has(id));
      const selectionChanged =
        nodes.length !== state.selection.nodes.length ||
        edges.length !== state.selection.edges.length;
      const popoverGone =
        (state.popover?.kind === 'edge' && !existing.edges.has(state.popover.edgeId)) ||
        (state.popover?.kind === 'connect' && !existing.nodes.has(state.popover.fromId));
      const patch: Partial<UiState> = {};
      if (selectionChanged) patch.selection = { nodes, edges };
      if (state.focusedId !== null && !existing.nodes.has(state.focusedId)) patch.focusedId = null;
      if (state.focusedEdgeId !== null && !existing.edges.has(state.focusedEdgeId))
        patch.focusedEdgeId = null;
      if (popoverGone) patch.popover = null;
      return patch;
    });
  },
  focus: (id) => {
    set({ focusedId: id, focusedEdgeId: null });
  },
  focusEdge: (id) => {
    set({ focusedEdgeId: id });
  },
  setLeftTab: (tab) => {
    set({ leftTab: tab });
  },
  toggleOutlineGroup: (groupId) => {
    set(({ outlineCollapsed }) => {
      const next = new Set(outlineCollapsed);
      if (!next.delete(groupId)) next.add(groupId);
      return { outlineCollapsed: next };
    });
  },
  setLabelsOn: (on) => {
    writeLabelsOn(on);
    set({ labelsOn: on });
  },
  openEdgePopover: (edgeId) => {
    set({ popover: { kind: 'edge', edgeId } });
  },
  openConnectPopover: (fromId) => {
    set({ popover: { kind: 'connect', fromId } });
  },
  closePopover: () => {
    set({ popover: null });
  },
  requestDelete: (selection) => {
    set({ pendingDelete: selection });
  },
  cancelDelete: () => {
    set({ pendingDelete: null });
  },
  announce: (text) => {
    set(({ announcement }) => ({ announcement: { text, seq: announcement.seq + 1 } }));
  },
  toggleJsonPanel: () => {
    set((state) => ({ jsonPanelOpen: !state.jsonPanelOpen }));
  },
  resetForDeck: () => {
    set({
      selection: EMPTY_SELECTION,
      focusedId: null,
      focusedEdgeId: null,
      outlineCollapsed: new Set(),
      popover: null,
      pendingDelete: null,
    });
  },
}));

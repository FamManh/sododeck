import type { FlowCheckpoint, RemovalTarget } from '@sododeck/model';
import { create } from 'zustand';

import {
  loadJsonPanelPrefs,
  saveJsonPanelPrefs,
  type JsonPanelPrefs,
  type JsonTab,
} from './json-panel-prefs';

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

/** Autoplay speed of flow mode (007). */
export type PlaybackSpeed = 1 | 2;

/**
 * The open flow (006), with its active step or branch. Outside a session this is flow mode (007
 * data-model §1): `stepId` is the current step, plus the chosen alternative, play state and speed.
 */
export type ActiveFlow = {
  flowId: string;
  /** Current step in flow mode; the selected step in an edit session (006). */
  stepId: string | null;
  /** A branch opened in the inspector (006). */
  branchId: string | null;
  /** Chosen alternative at the fork; `null` = the first ("a"). Forgotten on exit. */
  alternativeId: string | null;
  playing: boolean;
  speed: PlaybackSpeed;
} | null;

/** A freshly opened flow: paused, 1×, first alternative. */
export function openedFlow(
  flowId: string,
  stepId: string | null = null,
  alternativeId: string | null = null,
): NonNullable<ActiveFlow> {
  return { flowId, stepId, branchId: null, alternativeId, playing: false, speed: 1 };
}

/** The path new clicks extend: the main path, or one branch. */
export type SessionTarget = { kind: 'main' } | { kind: 'branch'; branchId: string };

/** A refused click (FR-010): drives the flash, the popover and the step-list message. */
export interface InvalidClick {
  edgeId: string;
  /** Number the step would have had, e.g. "5" or "4b". */
  stepNumber: string;
  /** Main-path step the edge could branch from ("Add as branch from step k"), if allowed. */
  branchFromStep: string | null;
}

/**
 * A recording (new flow) or edit session (existing flow), per tab (data-model §3). Steps are
 * written to the deck as they are clicked; this only holds ids, mode and notices, plus the
 * edit-mode checkpoint (plan, Complexity Tracking).
 */
export interface FlowSession {
  mode: 'record' | 'edit';
  /** `null` until the first step of a new flow is recorded (research R3). */
  flowId: string | null;
  /** Name typed at "+ New flow" (record mode, before the first step). */
  pendingTitle: string;
  featureId: string | null;
  target: SessionTarget;
  /** "adding branch after step n": the NEW BRANCH inspector is shown. */
  addingBranch: boolean;
  /** Step ids added in this session, for ⌘Z "Undo last step" (FR-014). */
  recorded: readonly string[];
  checkpoint: FlowCheckpoint | null;
  invalid: InvalidClick | null;
  /** Keyboard focus among candidate edges (FR-015). */
  candidateEdgeId: string | null;
  /** The "discard changes?" confirmation of Cancel / Esc is open (FR-013). */
  confirmingCancel: boolean;
  /**
   * Counts Done presses refused because the new branch has an empty label or condition: above 0
   * the inspector shows the inline errors, and each press moves focus to the first (FR-023).
   */
  branchCheck: number;
}

/** Write or Preview for one description field, keyed `${scope}:${id}` (008). */
export type DescriptionMode = 'write' | 'preview';

/** The canvas viewport, kept while the rule editor is shown (008). */
export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

/**
 * The rule editor's TEST INPUT (008 FR-026): UI-only, never in the deck. `from` is the step the
 * editor was opened from ("Edit rule"), for "Save as step inputs".
 */
export interface RuleTest {
  ruleId: string;
  /** Input column id → typed value. */
  values: Readonly<Record<string, string>>;
  from: { flowId: string; stepId: string } | null;
}

/** What the delete confirmation is open for. */
export interface PendingDelete {
  readonly targets: readonly RemovalTarget[];
}

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
  /** What the delete confirmation is open for. */
  pendingDelete: PendingDelete | null;
  activeFlow: ActiveFlow;
  /** Flow row marked "Last played" after leaving flow mode (007); cleared by `openFlow`. */
  lastPlayedFlowId: string | null;
  flowSession: FlowSession | null;
  /** Edge under the pointer during a session (the dotted preview). */
  hoverEdgeId: string | null;
  /** Flow list filter text (FR-034). */
  flowFilter: string;
  /** Live-region text; `seq` changes on every call so repeats are announced again. */
  announcement: { text: string; seq: number };
  /** JSON panel open/height/tab; persisted per browser (004). The app never switches the tab. */
  jsonPanel: JsonPanelPrefs;
  /** Write / Preview per description field; forgotten when the selection changes (008). */
  descriptionMode: Readonly<Record<string, DescriptionMode>>;
  canvasViewport: CanvasViewport | null;
  ruleTest: RuleTest | null;

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
  /** Opens the confirmation for a canvas selection (components first, then connections). */
  requestDelete: (selection: Selection) => void;
  /** Opens the confirmation for any removal targets (features, flows, branches…). */
  requestRemoval: (targets: readonly RemovalTarget[]) => void;
  cancelDelete: () => void;
  /** 006 alias: `openFlow(flowId)`, or `exitFlow()` for `null`. */
  setActiveFlow: (flowId: string | null) => void;
  /**
   * Enters flow mode (007): paused, 1×, on `stepId` (resolved by `flow-mode.ts` when null) and
   * `alternativeId`. Clears the canvas selection, focused edge, popover and "last played" mark.
   */
  openFlow: (flowId: string, stepId?: string | null, alternativeId?: string | null) => void;
  /** Leaves flow mode: nothing selected, the flow marked "last played". */
  exitFlow: () => void;
  /** Makes a step current and pauses. */
  setCurrentStep: (stepId: string | null) => void;
  setPlaying: (playing: boolean) => void;
  /** Changes speed and pauses. */
  setSpeed: (speed: PlaybackSpeed) => void;
  /** Chooses an alternative with the re-homed current step, and pauses. */
  setAlternative: (alternativeId: string | null, stepId: string | null) => void;
  /** Autoplay: the next step becomes current, still playing. */
  advance: (stepId: string) => void;
  setActiveStep: (stepId: string | null) => void;
  setActiveBranch: (branchId: string | null) => void;
  startRecording: (title: string, featureId: string | null) => void;
  startEditing: (flowId: string, checkpoint: FlowCheckpoint) => void;
  setSessionFlow: (flowId: string) => void;
  pushRecorded: (stepId: string) => void;
  popRecorded: () => void;
  setTarget: (target: SessionTarget) => void;
  setAddingBranch: (adding: boolean) => void;
  setInvalid: (invalid: InvalidClick | null) => void;
  setCandidate: (edgeId: string | null) => void;
  setConfirmingCancel: (open: boolean) => void;
  checkBranch: () => void;
  endSession: () => void;
  setHoverEdge: (edgeId: string | null) => void;
  setFlowFilter: (text: string) => void;
  announce: (text: string) => void;
  setDescriptionMode: (key: string, mode: DescriptionMode) => void;
  setCanvasViewport: (viewport: CanvasViewport | null) => void;
  /** Starts testing a rule (values empty unless given), or clears the test with `null`. */
  setRuleTest: (test: RuleTest | null) => void;
  /** Sets one TEST INPUT value of the rule being tested. */
  setRuleTestValue: (columnId: string, value: string) => void;
  setJsonPanelOpen: (open: boolean) => void;
  setJsonPanelHeight: (height: number) => void;
  setJsonTab: (tab: JsonTab) => void;
  toggleJsonPanel: () => void;
  /** Forgets everything that pointed into the previous deck (opening another one). */
  resetForDeck: () => void;
}

/** Flow mode (007): a flow is open outside a recording or edit session. */
export function isFlowMode(state: Pick<UiState, 'activeFlow' | 'flowSession'>): boolean {
  return state.activeFlow !== null && state.flowSession === null;
}

export const EMPTY_SELECTION: Selection = { nodes: [], edges: [] };

const NO_MODES: Readonly<Record<string, DescriptionMode>> = {};

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

/** Components first, then connections: the order the confirmation and the delete both use. */
export function selectionTargets(selection: Selection): RemovalTarget[] {
  return [
    ...selection.nodes.map((id): RemovalTarget => ({ scope: 'nodes', id })),
    ...selection.edges.map((id): RemovalTarget => ({ scope: 'edges', id })),
  ];
}

export const useUiStore = create<UiState>()((set, get) => {
  const patchSession = (patch: Partial<FlowSession>) => {
    const session = get().flowSession;
    if (session !== null) set({ flowSession: { ...session, ...patch } });
  };
  const patchFlow = (patch: Partial<NonNullable<ActiveFlow>>) => {
    const active = get().activeFlow;
    if (active === null) return;
    // A new step or branch is a new inspector target: forget its Write / Preview modes (008).
    const moved = 'stepId' in patch || 'branchId' in patch;
    set({ activeFlow: { ...active, ...patch }, ...(moved ? { descriptionMode: NO_MODES } : {}) });
  };
  const setJsonPanel = (patch: Partial<JsonPanelPrefs>) => {
    const jsonPanel = { ...get().jsonPanel, ...patch };
    saveJsonPanelPrefs(jsonPanel);
    set({ jsonPanel });
  };
  return {
    selection: EMPTY_SELECTION,
    focusedId: null,
    focusedEdgeId: null,
    leftTab: 'outline',
    outlineCollapsed: new Set(),
    labelsOn: readLabelsOn(),
    popover: null,
    pendingDelete: null,
    activeFlow: null,
    lastPlayedFlowId: null,
    flowSession: null,
    hoverEdgeId: null,
    flowFilter: '',
    announcement: { text: '', seq: 0 },
    jsonPanel: loadJsonPanelPrefs(),
    descriptionMode: NO_MODES,
    canvasViewport: null,
    ruleTest: null,

    select: ({ nodes = [], edges = [] }) => {
      const empty = nodes.length === 0 && edges.length === 0;
      set({
        selection: empty ? EMPTY_SELECTION : { nodes, edges },
        descriptionMode: NO_MODES,
        // Selecting on the canvas leaves the flow (outside a session, which keeps its flow).
        ...(empty || get().flowSession !== null ? {} : { activeFlow: null }),
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
          descriptionMode: NO_MODES,
        };
      });
    },
    clearSelection: () => {
      set({ selection: EMPTY_SELECTION, descriptionMode: NO_MODES });
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
        if (state.focusedId !== null && !existing.nodes.has(state.focusedId))
          patch.focusedId = null;
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
      set({ pendingDelete: { targets: selectionTargets(selection) } });
    },
    requestRemoval: (targets) => {
      set({ pendingDelete: { targets } });
    },
    setActiveFlow: (flowId) => {
      if (flowId === null) get().exitFlow();
      else get().openFlow(flowId);
    },
    openFlow: (flowId, stepId = null, alternativeId = null) => {
      set({
        activeFlow: openedFlow(flowId, stepId, alternativeId),
        lastPlayedFlowId: null,
        selection: EMPTY_SELECTION,
        focusedEdgeId: null,
        popover: null,
        descriptionMode: NO_MODES,
      });
    },
    exitFlow: () => {
      const state = get();
      set({
        activeFlow: null,
        ...(state.activeFlow !== null && isFlowMode(state)
          ? { lastPlayedFlowId: state.activeFlow.flowId }
          : {}),
        selection: EMPTY_SELECTION,
        focusedEdgeId: null,
        descriptionMode: NO_MODES,
      });
    },
    setCurrentStep: (stepId) => {
      patchFlow({ stepId, branchId: null, playing: false });
    },
    setPlaying: (playing) => {
      patchFlow({ playing });
    },
    setSpeed: (speed) => {
      patchFlow({ speed, playing: false });
    },
    setAlternative: (alternativeId, stepId) => {
      patchFlow({ alternativeId, stepId, branchId: null, playing: false });
    },
    advance: (stepId) => {
      patchFlow({ stepId, branchId: null });
    },
    setActiveStep: (stepId) => {
      patchFlow({ stepId, branchId: null, playing: false });
    },
    setActiveBranch: (branchId) => {
      patchFlow({ branchId, stepId: null, playing: false });
    },
    startRecording: (title, featureId) => {
      set({
        flowSession: {
          mode: 'record',
          flowId: null,
          pendingTitle: title,
          featureId,
          target: { kind: 'main' },
          addingBranch: false,
          recorded: [],
          checkpoint: null,
          invalid: null,
          candidateEdgeId: null,
          confirmingCancel: false,
          branchCheck: 0,
        },
        activeFlow: null,
        selection: EMPTY_SELECTION,
        popover: null,
        hoverEdgeId: null,
      });
    },
    startEditing: (flowId, checkpoint) => {
      set({
        flowSession: {
          mode: 'edit',
          flowId,
          pendingTitle: '',
          featureId: null,
          target: { kind: 'main' },
          addingBranch: false,
          recorded: [],
          checkpoint,
          invalid: null,
          candidateEdgeId: null,
          confirmingCancel: false,
          branchCheck: 0,
        },
        activeFlow: openedFlow(flowId),
        selection: EMPTY_SELECTION,
        popover: null,
        hoverEdgeId: null,
      });
    },
    setSessionFlow: (flowId) => {
      patchSession({ flowId });
      set({ activeFlow: openedFlow(flowId) });
    },
    pushRecorded: (stepId) => {
      const session = get().flowSession;
      if (session) patchSession({ recorded: [...session.recorded, stepId], invalid: null });
    },
    popRecorded: () => {
      const session = get().flowSession;
      if (session) patchSession({ recorded: session.recorded.slice(0, -1) });
    },
    setTarget: (target) => {
      patchSession({ target, candidateEdgeId: null });
    },
    setAddingBranch: (addingBranch) => {
      patchSession({ addingBranch, branchCheck: 0 });
    },
    setInvalid: (invalid) => {
      patchSession({ invalid });
    },
    setCandidate: (candidateEdgeId) => {
      patchSession({ candidateEdgeId });
    },
    setConfirmingCancel: (confirmingCancel) => {
      patchSession({ confirmingCancel });
    },
    checkBranch: () => {
      const session = get().flowSession;
      if (session) patchSession({ branchCheck: session.branchCheck + 1 });
    },
    endSession: () => {
      set({ flowSession: null, hoverEdgeId: null, focusedEdgeId: null });
    },
    setHoverEdge: (hoverEdgeId) => {
      set({ hoverEdgeId });
    },
    setFlowFilter: (flowFilter) => {
      set({ flowFilter });
    },
    cancelDelete: () => {
      set({ pendingDelete: null });
    },
    announce: (text) => {
      set(({ announcement }) => ({ announcement: { text, seq: announcement.seq + 1 } }));
    },
    setDescriptionMode: (key, mode) => {
      set(({ descriptionMode }) => ({ descriptionMode: { ...descriptionMode, [key]: mode } }));
    },
    setCanvasViewport: (canvasViewport) => {
      set({ canvasViewport });
    },
    setRuleTest: (ruleTest) => {
      set({ ruleTest });
    },
    setRuleTestValue: (columnId, value) => {
      const test = get().ruleTest;
      if (test !== null)
        set({ ruleTest: { ...test, values: { ...test.values, [columnId]: value } } });
    },
    setJsonPanelOpen: (open) => {
      setJsonPanel({ open });
    },
    setJsonPanelHeight: (height) => {
      setJsonPanel({ height });
    },
    setJsonTab: (tab) => {
      setJsonPanel({ tab });
    },
    toggleJsonPanel: () => {
      setJsonPanel({ open: !get().jsonPanel.open });
    },
    resetForDeck: () => {
      set({
        selection: EMPTY_SELECTION,
        focusedId: null,
        focusedEdgeId: null,
        outlineCollapsed: new Set(),
        popover: null,
        pendingDelete: null,
        activeFlow: null,
        lastPlayedFlowId: null,
        flowSession: null,
        hoverEdgeId: null,
        flowFilter: '',
        descriptionMode: NO_MODES,
        canvasViewport: null,
        ruleTest: null,
      });
    },
  };
});

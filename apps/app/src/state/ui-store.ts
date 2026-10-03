import type { FlowCheckpoint, RemovalTarget } from '@sododeck/model';
import type { ColorRef, EdgeShape, Id, Side } from '@sododeck/schema';
import type { ComponentKind } from '@sododeck/ui/lib/icons';
import { create } from 'zustand';

import { clampDrawerWidth } from '../editor/shell/shell-geometry';
import {
  DEFAULT_SHELL_PREFS,
  loadShellPrefs,
  saveShellPrefs,
  type FlyoutId,
  type ShellPrefs,
} from '../editor/shell/shell-prefs';
import type { NotesDisplay } from '../editor/stickies/sticky-flow';
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
  readonly nodes: readonly Id[];
  readonly edges: readonly Id[];
  readonly groups: readonly Id[];
  readonly stickies: readonly Id[];
}

export type Popover =
  | { kind: 'edge'; edgeId: string }
  | { kind: 'connect'; fromId: string }
  | { kind: 'merged'; edgeId: string }
  | null;

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

export interface DrillFrame {
  kind: 'group' | 'node';
  id: string;
  viewport: CanvasViewport;
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

/** A Tidy layout run (011): `slow` after 500 ms shows the progress bar and Cancel. */
export interface LayoutRun {
  status: 'idle' | 'running' | 'slow';
  viewId?: Id;
}

/**
 * The details drawer (018): `selection` shows the inspector of the current selection and closes
 * when there is nothing left to show; `deck` shows the deck (Deck settings) whatever is selected.
 */
export interface DrawerState {
  open: boolean;
  /** px, 320–560 (`clampDrawerWidth`). */
  width: number;
  mode: 'selection' | 'deck';
}

/**
 * Rail tools (018 R8). Select drags a marquee and Hand pans (§g-57); both stay on. Sticky and
 * Connector act on the next click, then fall back to Select.
 */
export type Tool = 'select' | 'hand' | 'sticky' | 'connector';

/**
 * A title being edited inside its card (019 R2). The draft text lives only in the input; the
 * document is written once, on commit. `isNew`: a just-added component ("Untitled <kind>", R3).
 */
export interface TitleEdit {
  target: 'node' | 'group';
  id: Id;
  isNew: boolean;
  kind?: ComponentKind;
}

/** What a canvas menu (and the action list) acts on (019 R7). `sticky`: only stickies selected. */
export type MenuTarget =
  | {
      kind:
        'component' | 'components' | 'connection' | 'connections' | 'group' | 'sticky' | 'mixed';
      ids: Selection;
    }
  | { kind: 'canvas' };

/** The open canvas menu: where it is anchored, how it was opened and who gets focus back. */
export interface ContextMenuState {
  target: MenuTarget;
  point: { x: number; y: number };
  via: 'pointer' | 'keyboard' | 'toolbar';
  returnFocus: HTMLElement | null;
}

/** The selection toolbar's popovers (019 R6). */
export type ToolbarFieldId =
  | 'kind'
  | 'owner'
  | 'tags'
  | 'tech'
  | 'links'
  | 'rules'
  | 'protocol'
  | 'direction'
  | 'style'
  | 'lineStyle';

/** A live, unsaved colour choice shown on canvas before it is applied (020 R9). */
export interface StylePreview {
  channel: 'fill' | 'stroke';
  value: ColorRef;
}

/**
 * A pointer gesture on the canvas: the selection toolbar hides while one runs (019 R5), and the
 * hint bar shows its keys (016 R13).
 */
export type CanvasGesture =
  | 'pan'
  | 'drag'
  | 'group-drag'
  | 'resize'
  | 'marquee'
  | 'card-resize'
  | 'bend'
  | 'anchor'
  | 'label'
  | 'endpoint';

/** The bends of a connector while one is dragged (022): UI-only until release, then one op. */
export interface BendPreview {
  edgeId: Id;
  bends: readonly { x: number; y: number }[];
}

/** A snapping guide during a drag (016 R7), in canvas px. UI-only, never saved. */
export interface Guide {
  axis: 'x' | 'y';
  /** The x (axis `x`, a vertical line) or y (axis `y`) the cards line up on. */
  at: number;
  /** Span of the line across the aligned cards, on the other axis. */
  from: number;
  to: number;
  /** Distance to the nearest neighbour on the other axis, and where its label goes. */
  distance?: { value: number; at: { x: number; y: number } };
  /** Equal gaps in the same row or column, and where their labels go. */
  equalGaps?: { value: number; at: { x: number; y: number } }[];
}

/** Where the last paste landed and how many repeats (016 FR-004: +24 px per repeat). */
export interface PasteSerial {
  at: { x: number; y: number };
  count: number;
}

export interface UiState {
  selection: Selection;
  /** The view this tab shows (011, FR-005); `null` = the first view. Never written to the deck. */
  currentViewId: Id | null;
  /**
   * Components created in this view while its filters hide them: kept visible until the view is
   * left, so a new component never vanishes under the pointer (011 spec edge case).
   */
  revealed: ReadonlySet<Id>;
  layoutRun: LayoutRun;
  /** Key of the last problem visited by ⌘. / ⇧⌘. or the list (015 FR-021). */
  problemCursor: string | null;
  drill: readonly DrillFrame[];
  focusMode: boolean;
  stickyEditing: Id | null;
  stickyDraft: Id | null;
  canvasPointer: { x: number; y: number } | null;
  palette: { open: boolean; returnFocus: HTMLElement | null };
  exportDialog: { open: boolean; returnFocus: HTMLElement | null };
  /** Roving-tabindex target on the canvas (US6). */
  focusedId: string | null;
  /** Connection reached with E from the focused node. */
  focusedEdgeId: string | null;
  outlineCollapsed: ReadonlySet<string>;
  labelsOn: boolean;
  notesDisplay: NotesDisplay;
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
  /** The deck whose shell preferences are read and saved (018); `null` = demo / memory deck. */
  shellDeckId: string | null;
  /** The flyout shown beside the rail (018 R4). */
  flyout: FlyoutId | null;
  /** The pinned flyout: stays open on canvas clicks and returns when a temporary one closes. */
  pinnedFlyout: FlyoutId | null;
  /** The pin to restore when a recording session ends (the session pins Flows). */
  sessionPinReturn: { pinned: FlyoutId | null; shown: FlyoutId | null } | null;
  drawer: DrawerState;
  /** Canvas object that gets focus back when the drawer closes. */
  drawerReturn: string | null;
  /**
   * Whether the JSON overlay is shown at all (⌘J, 018); `jsonPanel.open` is still 004's
   * expanded / collapsed state inside it. Remembered per deck (shell prefs).
   */
  jsonShown: boolean;
  /** Hide UI (⌘\): every island, flyout, drawer and overlay hidden; the rest is kept. */
  hideUi: boolean;
  minimap: boolean;
  tool: Tool;
  helpOpen: boolean;
  titleEdit: TitleEdit | null;
  contextMenu: ContextMenuState | null;
  toolbarField: ToolbarFieldId | null;
  /** The active tab in the fill/stroke picker (020). */
  stylePickerTab: 'fill' | 'stroke';
  /** The tag editor is open inside the tag picker (033): Escape goes back before it closes. */
  tagEditing: boolean;
  /** A colour hovered/typed in the picker but not yet applied (020 R9); cleared, never undone. */
  stylePreview: StylePreview | null;
  /**
   * The line type last picked in this tab; new connectors get it (029 R7). Memory only: never
   * saved, not reset when another deck opens, not changed by undo or paste.
   */
  lastLineShape: EdgeShape;
  canvasGesture: CanvasGesture | null;
  /** The frame a drag would drop into (016 R6, screen 110); null outside frames or with ⌥. */
  dropTarget: Id | null;
  guides: readonly Guide[];
  /** Offset of a group drag from its start, shown next to the frame. */
  dragReadout: { dx: number; dy: number } | null;
  /** The live bends of the connector being dragged (022); null outside a bend gesture. */
  bendPreview: BendPreview | null;
  /** What a connector handle shows while dragged: "x 288 · y 144", "left side · 78 %", "label 20 %". */
  connectorReadout: string | null;
  /** The `W × H` readout pill next to a dragged corner while resizing a card (017). */
  resizeReadout: { width: number; height: number; x: number; y: number } | null;
  /** The hot side target while an edge's end is dragged to reconnect it (017 R12). */
  endpointHover: { nodeId: Id; side: Side } | null;
  /** The edge whose end is being dragged to reconnect it (017 R12); drawn as a 40 % ghost. */
  reconnectingEdgeId: Id | null;
  /** Cards a running marquee selects. */
  marqueeCount: number | null;
  pasteSerial: PasteSerial | null;

  select: (selection: Partial<Selection>) => void;
  toggle: (id: Id, type: 'node' | 'edge' | 'sticky') => void;
  clearSelection: () => void;
  /** Drops every id that is not in the deck any more (after any document change). */
  pruneSelection: (existing: {
    nodes: ReadonlySet<Id>;
    edges: ReadonlySet<Id>;
    groups: ReadonlySet<Id>;
    stickies: ReadonlySet<Id>;
  }) => void;
  /**
   * Shows another view (011): clears selection, focus, drill-in, focus mode and revealed
   * components. An open flow stays open. The caller fits the canvas and announces.
   */
  switchView: (id: Id) => void;
  /** Keeps a just-created component visible in the current view (see `revealed`). */
  reveal: (id: Id) => void;
  setLayoutRun: (run: LayoutRun) => void;
  setProblemCursor: (key: string | null) => void;
  drillInto: (frame: DrillFrame) => void;
  drillUp: (depth?: number) => readonly DrillFrame[];
  setFocusMode: (on: boolean) => void;
  pruneView: (existing: { nodes: ReadonlySet<Id>; groups: ReadonlySet<Id> }) => void;
  setStickyEditing: (id: Id | null) => void;
  setStickyDraft: (id: Id | null) => void;
  setCanvasPointer: (point: { x: number; y: number } | null) => void;
  openPalette: (returnFocus?: HTMLElement | null) => void;
  closePalette: () => void;
  openExport: (returnFocus?: HTMLElement | null) => void;
  closeExport: () => void;
  focus: (id: string | null) => void;
  focusEdge: (id: string | null) => void;
  toggleOutlineGroup: (groupId: string) => void;
  setLabelsOn: (on: boolean) => void;
  setNotesDisplay: (display: NotesDisplay) => void;
  openEdgePopover: (edgeId: string) => void;
  openMergedPopover: (edgeId: string) => void;
  openConnectPopover: (fromId: string) => void;
  closePopover: () => void;
  /** Opens the confirmation for a canvas selection (components first, then connections). */
  requestDelete: (selection: Partial<Selection>) => void;
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
  /** Shows or hides the JSON overlay (⌘J), saved for this deck. */
  setJsonShown: (shown: boolean) => void;
  toggleJsonShown: () => void;
  /** Shows a flyout; the one already shown closes (and unpins) instead. */
  openFlyout: (id: FlyoutId) => void;
  /** Closes the shown flyout: the pinned one returns, or closing the pinned one unpins it. */
  closeFlyout: () => void;
  /** Esc or a click outside: closes an unpinned flyout only. */
  dismissFlyout: () => void;
  /** Pins or unpins the shown flyout (saved for this deck). */
  togglePin: () => void;
  /** A recording session starts: Flows is shown and pinned until it ends (never saved). */
  pinForSession: () => void;
  restoreAfterSession: () => void;
  /** Opens the drawer; without a selection it shows the deck. */
  openDrawer: (mode?: DrawerState['mode']) => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  /** Resizes the drawer; `commit` (end of a drag, a key) also saves the width for this deck. */
  setDrawerWidth: (px: number, options?: { commit?: boolean }) => void;
  setHideUi: (on: boolean) => void;
  setMinimap: (on: boolean) => void;
  setTool: (tool: Tool) => void;
  setHelpOpen: (open: boolean) => void;
  /**
   * Starts editing a title in place (019), closing the menu and any toolbar popover. Refused
   * (returns false) in flow mode and during a flow session (FR-010).
   */
  startTitleEdit: (edit: TitleEdit) => boolean;
  /** Ends the title edit; the caller has already committed or cancelled. */
  endTitleEdit: () => void;
  openContextMenu: (
    menu: Omit<ContextMenuState, 'returnFocus'> & { returnFocus?: HTMLElement | null },
  ) => void;
  closeContextMenu: () => void;
  openToolbarField: (id: ToolbarFieldId) => void;
  closeToolbarField: () => void;
  setStylePickerTab: (tab: 'fill' | 'stroke') => void;
  setTagEditing: (editing: boolean) => void;
  setStylePreview: (preview: StylePreview | null) => void;
  setLastLineShape: (shape: EdgeShape) => void;
  /** A pan, zoom or drag starts (closes the toolbar popover) or ends (`null`). */
  setCanvasGesture: (gesture: CanvasGesture | null) => void;
  setDropTarget: (groupId: Id | null) => void;
  setGuides: (guides: readonly Guide[]) => void;
  setDragReadout: (readout: { dx: number; dy: number } | null) => void;
  setBendPreview: (preview: BendPreview | null) => void;
  setConnectorReadout: (readout: string | null) => void;
  setResizeReadout: (
    readout: { width: number; height: number; x: number; y: number } | null,
  ) => void;
  setEndpointHover: (hover: { nodeId: Id; side: Side } | null) => void;
  setReconnectingEdge: (edgeId: Id | null) => void;
  setMarqueeCount: (count: number | null) => void;
  setPasteSerial: (serial: PasteSerial | null) => void;
  /**
   * Forgets everything that pointed into the previous deck (opening another one) and reads the
   * shell preferences of `deckId` (`null`: the demo or an in-memory deck, defaults only).
   */
  resetForDeck: (deckId?: string | null) => void;
}

/**
 * Whether the drawer has something to show in selection mode: a canvas selection, or the shown
 * or recorded flow (its inspector needs no canvas selection).
 */
export function hasDetailsTarget(
  state: Pick<UiState, 'selection' | 'activeFlow' | 'flowSession'>,
): boolean {
  const { nodes, edges, groups, stickies } = state.selection;
  return (
    nodes.length + edges.length + groups.length + stickies.length > 0 ||
    state.activeFlow !== null ||
    state.flowSession !== null
  );
}

/** Flow mode (007): a flow is open outside a recording or edit session. */
export function isFlowMode(state: Pick<UiState, 'activeFlow' | 'flowSession'>): boolean {
  return state.activeFlow !== null && state.flowSession === null;
}

export const EMPTY_SELECTION: Selection = { nodes: [], edges: [], groups: [], stickies: [] };

const NO_MODES: Readonly<Record<string, DescriptionMode>> = {};
const NO_IDS: ReadonlySet<Id> = new Set();
const IDLE_LAYOUT: LayoutRun = { status: 'idle' };

export const LABELS_KEY = 'sododeck.labels';
export const NOTES_KEY = 'sododeck.notes';

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

export function readNotesDisplay(): NotesDisplay {
  try {
    const stored = localStorage.getItem(NOTES_KEY);
    return stored === 'shown' || stored === 'hidden' ? stored : 'dimmed';
  } catch {
    return 'dimmed';
  }
}

function writeNotesDisplay(display: NotesDisplay): void {
  try {
    localStorage.setItem(NOTES_KEY, display);
  } catch {
    // non-critical preference
  }
}

const without = <T extends string>(ids: readonly T[], id: T) => ids.filter((x) => x !== id);

/** Components first, then connections: the order the confirmation and the delete both use. */
export function selectionTargets(selection: Partial<Selection>): RemovalTarget[] {
  return [
    ...(selection.nodes ?? []).map((id): RemovalTarget => ({ scope: 'nodes', id })),
    ...(selection.edges ?? []).map((id): RemovalTarget => ({ scope: 'edges', id })),
    ...(selection.stickies ?? []).map((id): RemovalTarget => ({ scope: 'stickies', id })),
  ];
}

const NO_GUIDES: readonly Guide[] = [];

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
  const shellPrefs = (): ShellPrefs => {
    const state = get();
    return {
      drawerWidth: state.drawer.width,
      pinnedFlyout: state.sessionPinReturn?.pinned ?? state.pinnedFlyout,
      jsonOpen: state.jsonShown,
    };
  };
  const saveShell = () => {
    saveShellPrefs(get().shellDeckId, shellPrefs());
  };
  const setJsonPanel = (patch: Partial<JsonPanelPrefs>) => {
    const jsonPanel = { ...get().jsonPanel, ...patch };
    saveJsonPanelPrefs(jsonPanel);
    set({ jsonPanel });
  };
  const setPinned = (pinnedFlyout: FlyoutId | null) => {
    set({ pinnedFlyout });
    // A session pin is temporary: the saved pin is the one the session will restore.
    const pinReturn = get().sessionPinReturn;
    if (pinReturn !== null) set({ sessionPinReturn: { ...pinReturn, pinned: pinnedFlyout } });
    saveShell();
  };
  return {
    selection: EMPTY_SELECTION,
    currentViewId: null,
    revealed: NO_IDS,
    layoutRun: IDLE_LAYOUT,
    problemCursor: null,
    drill: [],
    focusMode: false,
    stickyEditing: null,
    stickyDraft: null,
    canvasPointer: null,
    palette: { open: false, returnFocus: null },
    exportDialog: { open: false, returnFocus: null },
    focusedId: null,
    focusedEdgeId: null,
    outlineCollapsed: new Set(),
    labelsOn: readLabelsOn(),
    notesDisplay: readNotesDisplay(),
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
    shellDeckId: null,
    flyout: null,
    pinnedFlyout: null,
    sessionPinReturn: null,
    drawer: { open: false, width: DEFAULT_SHELL_PREFS.drawerWidth, mode: 'selection' },
    drawerReturn: null,
    jsonShown: false,
    hideUi: false,
    minimap: false,
    tool: 'select',
    helpOpen: false,
    titleEdit: null,
    contextMenu: null,
    toolbarField: null,
    stylePickerTab: 'fill',
    tagEditing: false,
    stylePreview: null,
    lastLineShape: 'curved',
    canvasGesture: null,
    dropTarget: null,
    guides: NO_GUIDES,
    dragReadout: null,
    bendPreview: null,
    connectorReadout: null,
    resizeReadout: null,
    endpointHover: null,
    reconnectingEdgeId: null,
    marqueeCount: null,
    pasteSerial: null,

    select: ({ nodes = [], edges = [], groups = [], stickies = [] }) => {
      const empty =
        nodes.length === 0 && edges.length === 0 && groups.length === 0 && stickies.length === 0;
      set({
        selection: empty ? EMPTY_SELECTION : { nodes, edges, groups, stickies },
        descriptionMode: NO_MODES,
        stylePreview: null,
        // Selecting on the canvas leaves the flow (outside a session, which keeps its flow).
        ...(empty || get().flowSession !== null ? {} : { activeFlow: null }),
      });
    },
    toggle: (id, type) => {
      set(({ selection }) => {
        const key = type === 'node' ? 'nodes' : type === 'edge' ? 'edges' : 'stickies';
        const list = selection[key];
        return {
          selection: {
            ...selection,
            [key]: list.includes(id) ? without(list, id) : [...list, id],
          },
          descriptionMode: NO_MODES,
          stylePreview: null,
        };
      });
    },
    clearSelection: () => {
      set({ selection: EMPTY_SELECTION, descriptionMode: NO_MODES, stylePreview: null });
    },
    pruneSelection: (existing) => {
      set((state) => {
        const nodes = state.selection.nodes.filter((id) => existing.nodes.has(id));
        const edges = state.selection.edges.filter((id) => existing.edges.has(id));
        const groups = state.selection.groups.filter((id) => existing.groups.has(id));
        const stickies = state.selection.stickies.filter((id) => existing.stickies.has(id));
        const selectionChanged =
          nodes.length !== state.selection.nodes.length ||
          edges.length !== state.selection.edges.length ||
          groups.length !== state.selection.groups.length ||
          stickies.length !== state.selection.stickies.length;
        const popoverGone =
          (state.popover?.kind === 'edge' && !existing.edges.has(state.popover.edgeId)) ||
          (state.popover?.kind === 'merged' && !existing.edges.has(state.popover.edgeId)) ||
          (state.popover?.kind === 'connect' && !existing.nodes.has(state.popover.fromId));
        const patch: Partial<UiState> = {};
        if (selectionChanged) patch.selection = { nodes, edges, groups, stickies };
        if (state.focusedId !== null && !existing.nodes.has(state.focusedId))
          patch.focusedId = null;
        if (state.focusedEdgeId !== null && !existing.edges.has(state.focusedEdgeId))
          patch.focusedEdgeId = null;
        if (popoverGone) patch.popover = null;
        if (state.dropTarget !== null && !existing.groups.has(state.dropTarget))
          patch.dropTarget = null;
        if (state.stickyEditing !== null && !existing.stickies.has(state.stickyEditing))
          patch.stickyEditing = null;
        if (state.stickyDraft !== null && !existing.stickies.has(state.stickyDraft))
          patch.stickyDraft = null;
        const edit = state.titleEdit;
        if (
          edit !== null &&
          !(edit.target === 'node' ? existing.nodes : existing.groups).has(edit.id)
        )
          patch.titleEdit = null;
        const menu = state.contextMenu?.target;
        if (
          menu !== undefined &&
          menu.kind !== 'canvas' &&
          (menu.ids.nodes.some((id) => !existing.nodes.has(id)) ||
            menu.ids.edges.some((id) => !existing.edges.has(id)) ||
            menu.ids.groups.some((id) => !existing.groups.has(id)) ||
            menu.ids.stickies.some((id) => !existing.stickies.has(id)))
        )
          patch.contextMenu = null;
        return patch;
      });
    },
    switchView: (id) => {
      set({
        currentViewId: id,
        titleEdit: null,
        contextMenu: null,
        toolbarField: null,
        selection: EMPTY_SELECTION,
        drill: [],
        focusMode: false,
        focusedId: null,
        focusedEdgeId: null,
        popover: null,
        revealed: NO_IDS,
        descriptionMode: NO_MODES,
        stylePreview: null,
      });
    },
    reveal: (id) => {
      set(({ revealed }) => ({ revealed: new Set([...revealed, id]) }));
    },
    setProblemCursor: (problemCursor) => {
      set({ problemCursor });
    },
    setLayoutRun: (layoutRun) => {
      set({ layoutRun });
    },
    drillInto: (frame) => {
      set((state) => ({
        drill: [...state.drill, frame],
        selection: EMPTY_SELECTION,
        focusMode: false,
        descriptionMode: NO_MODES,
      }));
    },
    drillUp: (depth) => {
      const drill = get().drill;
      const nextDepth = depth ?? Math.max(0, drill.length - 1);
      const popped = drill.slice(nextDepth);
      set({ drill: drill.slice(0, nextDepth) });
      return popped;
    },
    setFocusMode: (focusMode) => {
      set({ focusMode });
    },
    pruneView: (existing) => {
      set((state) => ({
        drill: state.drill.filter((frame) =>
          frame.kind === 'group' ? existing.groups.has(frame.id) : existing.nodes.has(frame.id),
        ),
      }));
    },
    setStickyEditing: (stickyEditing) => {
      set({ stickyEditing });
    },
    setStickyDraft: (stickyDraft) => {
      set({ stickyDraft });
    },
    setCanvasPointer: (canvasPointer) => {
      set({ canvasPointer });
    },
    openPalette: (returnFocus = null) => {
      set({ palette: { open: true, returnFocus } });
    },
    closePalette: () => {
      set({ palette: { open: false, returnFocus: null } });
    },
    openExport: (returnFocus = null) => {
      set({ exportDialog: { open: true, returnFocus } });
    },
    closeExport: () => {
      set({ exportDialog: { open: false, returnFocus: null } });
    },
    focus: (id) => {
      set({ focusedId: id, focusedEdgeId: null });
    },
    focusEdge: (id) => {
      set({ focusedEdgeId: id });
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
    setNotesDisplay: (notesDisplay) => {
      writeNotesDisplay(notesDisplay);
      set({ notesDisplay });
    },
    openEdgePopover: (edgeId) => {
      set({ popover: { kind: 'edge', edgeId } });
    },
    openMergedPopover: (edgeId) => {
      set({ popover: { kind: 'merged', edgeId } });
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
        titleEdit: null,
        contextMenu: null,
        toolbarField: null,
        selection: EMPTY_SELECTION,
        drill: [],
        focusMode: false,
        stickyEditing: null,
        stickyDraft: null,
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
        titleEdit: null,
        contextMenu: null,
        toolbarField: null,
        selection: EMPTY_SELECTION,
        focusMode: false,
        stickyEditing: null,
        stickyDraft: null,
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
        focusMode: false,
        titleEdit: null,
        contextMenu: null,
        toolbarField: null,
        selection: EMPTY_SELECTION,
        stickyEditing: null,
        stickyDraft: null,
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
    setJsonShown: (jsonShown) => {
      set({ jsonShown });
      saveShell();
    },
    toggleJsonShown: () => {
      get().setJsonShown(!get().jsonShown);
    },
    openFlyout: (id) => {
      const { flyout, pinnedFlyout } = get();
      if (flyout !== id) {
        set({ flyout: id });
        return;
      }
      if (pinnedFlyout === id) setPinned(null);
      set({ flyout: null });
    },
    closeFlyout: () => {
      const { flyout, pinnedFlyout } = get();
      if (flyout !== null && flyout === pinnedFlyout) {
        setPinned(null);
        set({ flyout: null });
        return;
      }
      set({ flyout: pinnedFlyout });
    },
    dismissFlyout: () => {
      const { flyout, pinnedFlyout } = get();
      if (flyout !== pinnedFlyout) set({ flyout: pinnedFlyout });
    },
    togglePin: () => {
      const { flyout, pinnedFlyout } = get();
      if (flyout === null) return;
      setPinned(pinnedFlyout === flyout ? null : flyout);
    },
    pinForSession: () => {
      const { pinnedFlyout, flyout, sessionPinReturn } = get();
      if (sessionPinReturn !== null) return;
      set({
        sessionPinReturn: { pinned: pinnedFlyout, shown: flyout },
        pinnedFlyout: 'flows',
        flyout: 'flows',
      });
    },
    restoreAfterSession: () => {
      const pinReturn = get().sessionPinReturn;
      if (pinReturn === null) return;
      set({
        sessionPinReturn: null,
        pinnedFlyout: pinReturn.pinned,
        flyout: pinReturn.pinned ?? (pinReturn.shown === 'flows' ? null : pinReturn.shown),
      });
    },
    openDrawer: (mode) => {
      const state = get();
      set({
        drawer: {
          ...state.drawer,
          open: true,
          mode: mode ?? (hasDetailsTarget(state) ? 'selection' : 'deck'),
        },
        drawerReturn: state.focusedId,
      });
    },
    closeDrawer: () => {
      set(({ drawer }) => ({ drawer: { ...drawer, open: false, mode: 'selection' } }));
    },
    toggleDrawer: () => {
      if (get().drawer.open) get().closeDrawer();
      else get().openDrawer();
    },
    setDrawerWidth: (px, options) => {
      const width = clampDrawerWidth(px, Number.POSITIVE_INFINITY);
      set(({ drawer }) => ({ drawer: { ...drawer, width } }));
      if (options?.commit === true) saveShell();
    },
    setHideUi: (hideUi) => {
      set({ hideUi });
    },
    setMinimap: (minimap) => {
      set({ minimap });
    },
    setTool: (tool) => {
      set({ tool });
    },
    setHelpOpen: (helpOpen) => {
      set({ helpOpen });
    },
    startTitleEdit: (titleEdit) => {
      const state = get();
      if (isFlowMode(state) || state.flowSession !== null) return false;
      set({ titleEdit, contextMenu: null, toolbarField: null });
      return true;
    },
    endTitleEdit: () => {
      set({ titleEdit: null });
    },
    openContextMenu: ({ returnFocus = null, ...menu }) => {
      set({ contextMenu: { ...menu, returnFocus }, toolbarField: null });
    },
    closeContextMenu: () => {
      set({ contextMenu: null });
    },
    openToolbarField: (toolbarField) => {
      set({ toolbarField, contextMenu: null });
    },
    closeToolbarField: () => {
      set({ toolbarField: null, stylePreview: null });
    },
    setStylePickerTab: (stylePickerTab) => {
      set({ stylePickerTab });
    },
    setTagEditing: (tagEditing) => {
      set({ tagEditing });
    },
    setStylePreview: (stylePreview) => {
      set({ stylePreview });
    },
    setLastLineShape: (lastLineShape) => {
      set({ lastLineShape });
    },
    setCanvasGesture: (canvasGesture) => {
      set(
        canvasGesture === null
          ? { canvasGesture }
          : { canvasGesture, toolbarField: null, stylePreview: null },
      );
    },
    setDropTarget: (dropTarget) => {
      if (get().dropTarget !== dropTarget) set({ dropTarget });
    },
    setGuides: (guides) => {
      if (guides.length === 0 && get().guides.length === 0) return;
      set({ guides: guides.length === 0 ? NO_GUIDES : guides });
    },
    setBendPreview: (bendPreview) => {
      set({ bendPreview });
    },
    setConnectorReadout: (connectorReadout) => {
      set({ connectorReadout });
    },
    setDragReadout: (dragReadout) => {
      set({ dragReadout });
    },
    setResizeReadout: (resizeReadout) => {
      set({ resizeReadout });
    },
    setEndpointHover: (endpointHover) => {
      set({ endpointHover });
    },
    setReconnectingEdge: (reconnectingEdgeId) => {
      set({ reconnectingEdgeId });
    },
    setMarqueeCount: (marqueeCount) => {
      if (get().marqueeCount !== marqueeCount) set({ marqueeCount });
    },
    setPasteSerial: (pasteSerial) => {
      set({ pasteSerial });
    },
    resetForDeck: (deckId = null) => {
      const prefs = loadShellPrefs(deckId);
      set({
        shellDeckId: deckId,
        flyout: prefs.pinnedFlyout,
        pinnedFlyout: prefs.pinnedFlyout,
        sessionPinReturn: null,
        drawer: { open: false, width: prefs.drawerWidth, mode: 'selection' },
        drawerReturn: null,
        hideUi: false,
        minimap: false,
        tool: 'select',
        helpOpen: false,
        jsonShown: prefs.jsonOpen,
        selection: EMPTY_SELECTION,
        currentViewId: null,
        revealed: NO_IDS,
        layoutRun: IDLE_LAYOUT,
        problemCursor: null,
        stickyEditing: null,
        stickyDraft: null,
        focusedId: null,
        focusedEdgeId: null,
        outlineCollapsed: new Set(),
        drill: [],
        focusMode: false,
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
        canvasPointer: null,
        palette: { open: false, returnFocus: null },
        exportDialog: { open: false, returnFocus: null },
        titleEdit: null,
        contextMenu: null,
        toolbarField: null,
        canvasGesture: null,
        dropTarget: null,
        guides: NO_GUIDES,
        dragReadout: null,
        bendPreview: null,
        connectorReadout: null,
        resizeReadout: null,
        endpointHover: null,
        reconnectingEdgeId: null,
        marqueeCount: null,
        pasteSerial: null,
      });
    },
  };
});

/**
 * The drawer in selection mode closes once there is nothing left to show (018 FR-027): the
 * selection was cleared, pruned by a removal or undo, or the flow was left.
 */
useUiStore.subscribe((state) => {
  if (state.drawer.open && state.drawer.mode === 'selection' && !hasDetailsTarget(state)) {
    state.closeDrawer();
  }
});

import { captureFlowStructure } from '@sododeck/model';
import { emptySododeckFile } from '@sododeck/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JSON_PANEL_KEY } from './json-panel-prefs';
import {
  isFlowMode,
  LABELS_KEY,
  NOTES_KEY,
  readLabelsOn,
  readNotesDisplay,
  useUiStore,
} from './ui-store';

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

  describe('canvas editing (016)', () => {
    const guide = { axis: 'x' as const, at: 10, from: 0, to: 100 };

    it('holds the gesture state, UI-only', () => {
      state().setCanvasGesture('group-drag');
      state().setDropTarget('g');
      state().setGuides([guide]);
      state().setDragReadout({ dx: 100, dy: -40 });
      state().setResizeReadout({ width: 200, height: 120, x: 10, y: 20 });
      state().setEndpointHover({ nodeId: 'n1', side: 'top' });
      state().setMarqueeCount(3);
      state().setPasteSerial({ at: { x: 1, y: 2 }, count: 2 });
      expect(state()).toMatchObject({
        canvasGesture: 'group-drag',
        dropTarget: 'g',
        guides: [guide],
        dragReadout: { dx: 100, dy: -40 },
        resizeReadout: { width: 200, height: 120, x: 10, y: 20 },
        endpointHover: { nodeId: 'n1', side: 'top' },
        marqueeCount: 3,
        pasteSerial: { at: { x: 1, y: 2 }, count: 2 },
      });
      for (const gesture of ['resize', 'marquee', 'card-resize', 'segment', 'endpoint'] as const) {
        state().setCanvasGesture(gesture);
        expect(state().canvasGesture).toBe(gesture);
      }
    });

    it('clears everything when another deck opens', () => {
      state().setDropTarget('g');
      state().setGuides([guide]);
      state().setDragReadout({ dx: 1, dy: 1 });
      state().setResizeReadout({ width: 200, height: 120, x: 10, y: 20 });
      state().setEndpointHover({ nodeId: 'n1', side: 'top' });
      state().setMarqueeCount(3);
      state().setPasteSerial({ at: { x: 1, y: 2 }, count: 2 });
      state().resetForDeck(null);
      expect(state()).toMatchObject({
        dropTarget: null,
        guides: [],
        dragReadout: null,
        resizeReadout: null,
        endpointHover: null,
        marqueeCount: null,
        pasteSerial: null,
      });
    });

    it('drops a drop target whose group is gone', () => {
      state().setDropTarget('g');
      const none = new Set<string>();
      state().pruneSelection({ nodes: none, edges: none, groups: new Set(['g']), stickies: none });
      expect(state().dropTarget).toBe('g');
      state().pruneSelection({ nodes: none, edges: none, groups: none, stickies: none });
      expect(state().dropTarget).toBeNull();
    });

    it('keeps the same guides array when nothing changed', () => {
      state().setGuides([]);
      const before = state().guides;
      state().setGuides([]);
      expect(state().guides).toBe(before);
    });
  });

  it('keeps the last visited problem until the deck changes (015 FR-021)', () => {
    const ui = useUiStore.getState;
    expect(ui().problemCursor).toBeNull();
    ui().setProblemCursor('orphan:n1');
    expect(ui().problemCursor).toBe('orphan:n1');
    ui().resetForDeck();
    expect(ui().problemCursor).toBeNull();
  });

  it('selects, toggles and clears nodes and edges', () => {
    state().select({ nodes: ['a'], groups: ['g'] });
    expect(state().selection).toEqual({ nodes: ['a'], edges: [], groups: ['g'], stickies: [] });
    state().toggle('b', 'node');
    state().toggle('e1', 'edge');
    expect(state().selection).toEqual({
      nodes: ['a', 'b'],
      edges: ['e1'],
      groups: ['g'],
      stickies: [],
    });
    state().toggle('a', 'node');
    expect(state().selection).toEqual({ nodes: ['b'], edges: ['e1'], groups: ['g'], stickies: [] });
    state().clearSelection();
    expect(state().selection).toEqual({ nodes: [], edges: [], groups: [], stickies: [] });
  });

  describe('style preview (020 R9)', () => {
    it('defaults to the fill tab and no preview', () => {
      expect(state().stylePickerTab).toBe('fill');
      expect(state().stylePreview).toBeNull();
    });

    it('sets and switches the picker tab and preview colour', () => {
      state().setStylePickerTab('stroke');
      expect(state().stylePickerTab).toBe('stroke');
      state().setStylePreview({ channel: 'stroke', value: '#7a3cff' });
      expect(state().stylePreview).toEqual({ channel: 'stroke', value: '#7a3cff' });
    });

    it('clears the preview on a selection change', () => {
      state().setStylePreview({ channel: 'fill', value: 'green' });
      state().select({ nodes: ['a'] });
      expect(state().stylePreview).toBeNull();
      state().setStylePreview({ channel: 'fill', value: 'green' });
      state().toggle('b', 'node');
      expect(state().stylePreview).toBeNull();
      state().setStylePreview({ channel: 'fill', value: 'green' });
      state().clearSelection();
      expect(state().stylePreview).toBeNull();
    });

    it('clears the preview when the toolbar field closes or a canvas gesture starts', () => {
      state().setStylePreview({ channel: 'fill', value: 'green' });
      state().closeToolbarField();
      expect(state().stylePreview).toBeNull();
      state().setStylePreview({ channel: 'fill', value: 'green' });
      state().setCanvasGesture('pan');
      expect(state().stylePreview).toBeNull();
    });
  });

  it('prunes ids that no longer exist, and keeps the same object when nothing is pruned', () => {
    state().select({
      nodes: ['a', 'gone'],
      edges: ['e1'],
      groups: ['g', 'gone-group'],
      stickies: ['st1', 'gone-sticky'],
    });
    state().setStickyEditing('gone-sticky');
    state().setStickyDraft('gone-sticky');
    state().pruneSelection({
      nodes: new Set(['a']),
      edges: new Set(['e1']),
      groups: new Set(['g']),
      stickies: new Set(['st1']),
    });
    expect(state().selection).toEqual({
      nodes: ['a'],
      edges: ['e1'],
      groups: ['g'],
      stickies: ['st1'],
    });
    expect(state().stickyEditing).toBeNull();
    expect(state().stickyDraft).toBeNull();
    const kept = state().selection;
    state().pruneSelection({
      nodes: new Set(['a']),
      edges: new Set(['e1']),
      groups: new Set(['g']),
      stickies: new Set(['st1']),
    });
    expect(state().selection).toBe(kept);
  });

  it('prunes the focused node and edge, and closes a popover whose object is gone', () => {
    state().focus('a');
    state().focusEdge('e1');
    state().openEdgePopover('e1');
    state().pruneSelection({
      nodes: new Set(),
      edges: new Set(),
      groups: new Set(),
      stickies: new Set(),
    });
    expect(state().focusedId).toBeNull();
    expect(state().focusedEdgeId).toBeNull();
    expect(state().popover).toBeNull();
    state().openConnectPopover('a');
    state().pruneSelection({
      nodes: new Set(),
      edges: new Set(),
      groups: new Set(),
      stickies: new Set(),
    });
    expect(state().popover).toBeNull();
  });

  it('tracks drill, focus mode, and view pruning (collapse lives in the view, 011)', () => {
    expect(state().drill).toEqual([]);
    state().setFocusMode(true);
    state().select({ nodes: ['a'] });
    state().drillInto({ kind: 'group', id: 'g', viewport: { x: 1, y: 2, zoom: 0.5 } });
    expect(state().selection).toEqual({ nodes: [], edges: [], groups: [], stickies: [] });
    expect(state().focusMode).toBe(false);
    expect(state().drill).toHaveLength(1);

    expect(state()).not.toHaveProperty('collapsed');

    const popped = state().drillUp();
    expect(popped).toEqual([{ kind: 'group', id: 'g', viewport: { x: 1, y: 2, zoom: 0.5 } }]);
    expect(state().drill).toEqual([]);

    state().drillInto({ kind: 'node', id: 'a', viewport: { x: 0, y: 0, zoom: 1 } });
    state().pruneView({ nodes: new Set(), groups: new Set() });
    expect(state().drill).toEqual([]);
  });

  describe('views (011)', () => {
    it('starts on the first view with nothing revealed and no layout running', () => {
      expect(state().currentViewId).toBeNull();
      expect(state().revealed.size).toBe(0);
      expect(state().layoutRun).toEqual({ status: 'idle' });
    });

    it('switches views, clearing selection, drill, focus mode and revealed components', () => {
      state().select({ nodes: ['a'], groups: ['g'] });
      state().drillInto({ kind: 'group', id: 'g', viewport: { x: 0, y: 0, zoom: 1 } });
      state().select({ nodes: ['a'] });
      state().setFocusMode(true);
      state().focus('a');
      state().reveal('a');
      expect([...state().revealed]).toEqual(['a']);
      state().switchView('infra');
      expect(state().currentViewId).toBe('infra');
      expect(state().selection).toEqual({ nodes: [], edges: [], groups: [], stickies: [] });
      expect(state().drill).toEqual([]);
      expect(state().focusMode).toBe(false);
      expect(state().focusedId).toBeNull();
      expect(state().revealed.size).toBe(0);
    });

    it('keeps a flow open when switching views (flows stay shown)', () => {
      state().openFlow('f1', 's1');
      state().switchView('infra');
      expect(state().activeFlow?.flowId).toBe('f1');
    });

    it('tracks the layout run and forgets views for another deck', () => {
      state().setLayoutRun({ status: 'running', viewId: 'infra' });
      expect(state().layoutRun).toEqual({ status: 'running', viewId: 'infra' });
      state().switchView('infra');
      state().reveal('x');
      state().resetForDeck();
      expect(state().currentViewId).toBeNull();
      expect(state().revealed.size).toBe(0);
      expect(state().layoutRun).toEqual({ status: 'idle' });
    });
  });

  it('tracks sticky editing, drafts and the last canvas pointer', () => {
    state().setStickyEditing('st1');
    state().setStickyDraft('st2');
    state().setCanvasPointer({ x: 10, y: 20 });
    expect(state().stickyEditing).toBe('st1');
    expect(state().stickyDraft).toBe('st2');
    expect(state().canvasPointer).toEqual({ x: 10, y: 20 });
  });

  it('opens and closes the palette with its return focus element', () => {
    const button = document.createElement('button');
    state().openPalette(button);
    expect(state().palette).toEqual({ open: true, returnFocus: button });
    state().closePalette();
    expect(state().palette).toEqual({ open: false, returnFocus: null });
  });

  it('opens, closes, and resets the export dialog', () => {
    const button = document.createElement('button');
    state().openExport(button);
    expect(state().exportDialog).toEqual({ open: true, returnFocus: button });
    state().closeExport();
    expect(state().exportDialog).toEqual({ open: false, returnFocus: null });
    state().openExport(button);
    state().resetForDeck();
    expect(state().exportDialog).toEqual({ open: false, returnFocus: null });
  });

  it('tracks focus', () => {
    state().focus('a');
    expect(state().focusedId).toBe('a');
    state().focusEdge('e1');
    expect(state().focusedEdgeId).toBe('e1');
    state().focus('b');
    expect(state().focusedEdgeId).toBeNull();
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

  it('defaults notesDisplay to dimmed, persists it, and survives localStorage failures', () => {
    expect(state().notesDisplay).toBe('dimmed');
    state().setNotesDisplay('shown');
    expect(state().notesDisplay).toBe('shown');
    expect(localStorage.getItem(NOTES_KEY)).toBe('shown');
    expect(readNotesDisplay()).toBe('shown');

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readNotesDisplay()).toBe('dimmed');
    state().setNotesDisplay('hidden');
    expect(state().notesDisplay).toBe('hidden');
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
    expect(state().pendingDelete).toEqual({ targets: [{ scope: 'nodes', id: 'a' }] });
    state().cancelDelete();
    expect(state().pendingDelete).toBeNull();
  });

  it('collapses outline groups', () => {
    state().toggleOutlineGroup('g');
    expect(state().outlineCollapsed.has('g')).toBe(true);
    state().toggleOutlineGroup('g');
    expect(state().outlineCollapsed.has('g')).toBe(false);
  });

  it('announces, counting repeats', () => {
    state().announce('Added Untitled service');
    const first = state().announcement;
    state().announce('Added Untitled service');
    expect(state().announcement.text).toBe('Added Untitled service');
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
    state().pruneSelection({
      nodes: new Set(),
      edges: new Set(),
      groups: new Set(),
      stickies: new Set(),
    });
    expect(state().jsonPanel.tab).toBe('selection');
  });

  describe('flows (006)', () => {
    const checkpoint = captureFlowStructure(
      { ...emptySododeckFile(), flows: [{ id: 'f', title: 'F', steps: [] }] },
      'f',
    );

    it('shows a flow, a step or a branch, and clears the canvas selection', () => {
      state().select({ nodes: ['a'], edges: ['e'] });
      state().setActiveFlow('f');
      expect(state().selection).toEqual({ nodes: [], edges: [], groups: [], stickies: [] });
      expect(state().activeFlow).toMatchObject({ flowId: 'f', stepId: null, branchId: null });
      state().setActiveStep('s1');
      expect(state().activeFlow).toMatchObject({ flowId: 'f', stepId: 's1', branchId: null });
      state().setActiveBranch('b1');
      expect(state().activeFlow).toMatchObject({ flowId: 'f', stepId: null, branchId: 'b1' });
      state().select({ nodes: ['a'] });
      expect(state().activeFlow).toBeNull();
    });

    it('does not start a step or branch without an active flow', () => {
      state().setActiveStep('s1');
      state().setActiveBranch('b1');
      expect(state().activeFlow).toBeNull();
    });

    it('runs a recording session: pending name, first step, recorded ids, notices', () => {
      state().setActiveFlow('other');
      state().startRecording('Place order', 'feat');
      expect(state().activeFlow).toBeNull();
      expect(state().flowSession).toMatchObject({
        mode: 'record',
        flowId: null,
        pendingTitle: 'Place order',
        featureId: 'feat',
        target: { kind: 'main' },
        recorded: [],
      });
      state().setSessionFlow('f');
      expect(state().activeFlow).toMatchObject({ flowId: 'f', stepId: null, branchId: null });
      state().setInvalid({ edgeId: 'e', stepNumber: '2', branchFromStep: null });
      state().pushRecorded('s1');
      state().pushRecorded('s2');
      expect(state().flowSession?.invalid).toBeNull();
      state().popRecorded();
      expect(state().flowSession?.recorded).toEqual(['s1']);
      state().setCandidate('e2');
      state().setTarget({ kind: 'branch', branchId: 'b' });
      expect(state().flowSession).toMatchObject({
        target: { kind: 'branch', branchId: 'b' },
        candidateEdgeId: null,
      });
      state().setAddingBranch(true);
      expect(state().flowSession?.addingBranch).toBe(true);
      state().setHoverEdge('e3');
      state().endSession();
      expect(state().flowSession).toBeNull();
      expect(state().hoverEdgeId).toBeNull();
      expect(state().activeFlow).toMatchObject({ flowId: 'f', stepId: null, branchId: null });
    });

    it('starts an edit session with its checkpoint and keeps the flow on canvas selection', () => {
      state().startEditing('f', checkpoint);
      expect(state().flowSession).toMatchObject({ mode: 'edit', flowId: 'f', checkpoint });
      state().select({ nodes: ['a'] });
      expect(state().activeFlow?.flowId).toBe('f');
    });

    it('ignores session actions without a session', () => {
      state().pushRecorded('s1');
      state().setInvalid(null);
      expect(state().flowSession).toBeNull();
    });

    it('opens the confirmation for any removal targets', () => {
      state().requestRemoval([{ scope: 'features', id: 'feat' }]);
      expect(state().pendingDelete).toEqual({ targets: [{ scope: 'features', id: 'feat' }] });
    });

    it('enters flow mode paused at 1x and leaves it marking the flow last played (007)', () => {
      state().select({ nodes: ['a'] });
      state().focus('a');
      state().openEdgePopover('e');
      state().drillInto({ kind: 'group', id: 'g', viewport: { x: 1, y: 2, zoom: 0.5 } });
      state().openFlow('f', 's2', 'alt');
      expect(state().activeFlow).toEqual({
        flowId: 'f',
        stepId: 's2',
        branchId: null,
        alternativeId: 'alt',
        playing: false,
        speed: 1,
      });
      expect(state().selection).toEqual({ nodes: [], edges: [], groups: [], stickies: [] });
      expect(state().drill).toEqual([]);
      expect(state().focusedEdgeId).toBeNull();
      expect(state().popover).toBeNull();
      expect(isFlowMode(state())).toBe(true);
      state().exitFlow();
      expect(state().activeFlow).toBeNull();
      expect(state().lastPlayedFlowId).toBe('f');
      expect(isFlowMode(state())).toBe(false);
      state().openFlow('g');
      expect(state().lastPlayedFlowId).toBeNull();
    });

    it('pauses on step changes, speed changes and alternative switches; autoplay keeps playing', () => {
      state().openFlow('f', 's1');
      state().setPlaying(true);
      state().advance('s2');
      expect(state().activeFlow).toMatchObject({ stepId: 's2', playing: true });
      state().setCurrentStep('s3');
      expect(state().activeFlow).toMatchObject({ stepId: 's3', playing: false });
      state().setPlaying(true);
      state().setSpeed(2);
      expect(state().activeFlow).toMatchObject({ speed: 2, playing: false });
      state().setPlaying(true);
      state().setAlternative('b', 's4b');
      expect(state().activeFlow).toMatchObject({
        alternativeId: 'b',
        stepId: 's4b',
        playing: false,
      });
    });

    it('is not flow mode during a session, which stops playback', () => {
      state().openFlow('f', 's1');
      state().setPlaying(true);
      state().startEditing('f', checkpoint);
      expect(isFlowMode(state())).toBe(false);
      expect(state().activeFlow).toMatchObject({ flowId: 'f', playing: false });
    });

    it('forgets the last played flow when another deck opens', () => {
      state().openFlow('f');
      state().exitFlow();
      state().resetForDeck();
      expect(state().lastPlayedFlowId).toBeNull();
    });

    it('ignores playback actions without an open flow', () => {
      state().setPlaying(true);
      state().setSpeed(2);
      state().advance('s');
      state().exitFlow();
      expect(state().activeFlow).toBeNull();
      expect(state().lastPlayedFlowId).toBeNull();
    });

    it('keeps the filter text', () => {
      state().setFlowFilter('fail');
      expect(state().flowFilter).toBe('fail');
    });
  });

  it('keeps Write / Preview per description and forgets it when the selection changes (008)', () => {
    const ui = useUiStore.getState;
    ui().setDescriptionMode('nodes:a', 'preview');
    ui().setDescriptionMode('nodes:b', 'write');
    expect(ui().descriptionMode).toEqual({ 'nodes:a': 'preview', 'nodes:b': 'write' });
    ui().select({ nodes: ['a'] });
    expect(ui().descriptionMode).toEqual({});
    ui().setDescriptionMode('flows:f', 'preview');
    ui().setActiveFlow('f');
    expect(ui().descriptionMode).toEqual({});
    ui().setDescriptionMode('step:s', 'preview');
    ui().setActiveStep('s');
    expect(ui().descriptionMode).toEqual({});
    ui().setDescriptionMode('deck', 'preview');
    ui().clearSelection();
    expect(ui().descriptionMode).toEqual({});
  });

  it('keeps the canvas viewport and the rule test, and forgets both for another deck (008)', () => {
    const ui = useUiStore.getState;
    ui().setCanvasViewport({ x: 10, y: -5, zoom: 1.5 });
    expect(ui().canvasViewport).toEqual({ x: 10, y: -5, zoom: 1.5 });
    ui().setRuleTestValue('c1', 'ignored');
    expect(ui().ruleTest).toBeNull();
    ui().setRuleTest({ ruleId: 'R', values: { c1: '5' }, from: { flowId: 'f', stepId: 's' } });
    ui().setRuleTestValue('c2', 'Express');
    expect(ui().ruleTest).toEqual({
      ruleId: 'R',
      values: { c1: '5', c2: 'Express' },
      from: { flowId: 'f', stepId: 's' },
    });
    ui().resetForDeck();
    expect(ui().canvasViewport).toBeNull();
    expect(ui().ruleTest).toBeNull();
  });

  it('forgets deck references when another deck opens', () => {
    state().setActiveFlow('f');
    state().startRecording('x', null);
    state().setFlowFilter('x');
    state().select({ nodes: ['a'] });
    state().focus('a');
    state().openEdgePopover('e');
    state().requestDelete({ nodes: ['a'], edges: [] });
    state().setLabelsOn(true);
    state().resetForDeck();
    expect(state()).toMatchObject({
      selection: { nodes: [], edges: [], groups: [], stickies: [] },
      focusedId: null,
      popover: null,
      pendingDelete: null,
      activeFlow: null,
      flowSession: null,
      hoverEdgeId: null,
      flowFilter: '',
      labelsOn: true,
      stickyEditing: null,
      stickyDraft: null,
      canvasPointer: null,
      palette: { open: false, returnFocus: null },
    });
  });
});

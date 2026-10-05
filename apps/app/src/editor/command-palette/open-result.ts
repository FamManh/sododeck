import {
  imageBox,
  nodeCanvasPosition,
  stickyCanvasPosition,
  type DeckEditor,
} from '@sododeck/model';
import type { View } from '@sododeck/schema';

import { readDeck } from '../../model/use-deck-snapshot';
import { isFlowMode, type Selection, type UiState, useUiStore } from '../../state/ui-store';
import { cardSize, groupBounds, tableLayoutOf } from '../canvas-geometry';
import { levelForZoom } from '../levels';
import { oneStep } from '../fields/one-step';
import { rowsDrawn } from '../deck-to-flow';
import { focusRowSoon } from '../table/row-focus';
import { rowAnchorY } from '../table-layout';
import { readViewState, selectView, setGroupCollapsed } from '../views/use-current-view';

import type { PaletteResult } from './palette-results';

type CanvasKind = 'node' | 'table' | 'column' | 'edge' | 'flow' | 'step' | 'sticky' | 'image';

function isCanvasKind(kind: PaletteResult['kind']): kind is CanvasKind {
  return (
    kind === 'node' ||
    kind === 'table' ||
    kind === 'column' ||
    kind === 'edge' ||
    kind === 'flow' ||
    kind === 'step' ||
    kind === 'sticky' ||
    kind === 'image'
  );
}

export interface OpenResultContext {
  editor: DeckEditor;
  screen: 'canvas' | 'rules';
  announce: (text: string) => void;
  openRules: (ruleId?: string) => void;
  navigateToCanvas: () => void;
  fitView: (options: { nodes: { id: string }[]; duration: number; maxZoom: number }) => unknown;
  setCenter: (x: number, y: number, options: { zoom: number }) => unknown;
  getZoom: () => number;
  select: (selection: Partial<Selection>) => void;
  focus: UiState['focus'];
  exitFlow: () => void;
  openFlow: (editor: DeckEditor, flowId: string, stepId?: string | null) => void;
  /** The current view hides this component (011 FR-016). */
  isHidden?: (nodeId: string) => boolean;
  /** The first view that shows this component, if any. */
  firstViewShowing?: (nodeId: string) => Pick<View, 'id' | 'title'> | null;
  /** The collapsed schema group (048) hiding this table in the current view, if any. */
  collapsedSchemaOf?: (nodeId: string) => { groupId: string; title: string } | null;
  /** Shows a toast, with an optional action that takes focus. */
  showToast?: (message: string, action?: { label: string; onAction: () => void }) => void;
}

function selectionFor(result: PaletteResult): Partial<Selection> {
  switch (result.kind) {
    case 'node':
    case 'table':
      return { nodes: [result.id] };
    case 'column':
      return result.tableId === undefined ? {} : { nodes: [result.tableId] };
    case 'edge':
      return { edges: [result.id] };
    case 'sticky':
      return { stickies: [result.id] };
    case 'image':
      return { images: [result.id] };
    default:
      return {};
  }
}

function ensureCanvasReady(result: PaletteResult, context: OpenResultContext): void {
  if (context.screen === 'rules' && isCanvasKind(result.kind)) context.navigateToCanvas();
  if (isCanvasKind(result.kind) && isFlowMode(useUiStore.getState())) {
    context.exitFlow();
  }
}

/**
 * The midpoint of an edge's two ends, each card sized by its own stored size (017 R2); a group end
 * (050 R6) is its frame's centre.
 */
export function edgeCenter(
  deck: ReturnType<typeof readDeck>,
  fromId: string,
  toId: string,
  zoom: number,
): { x: number; y: number } | null {
  const level = levelForZoom(zoom);
  const centre = (id: string): { x: number; y: number } | null => {
    const node = deck.nodes.find((n) => n.id === id);
    if (node === undefined) {
      const frame = groupBounds(deck, level).get(id);
      return frame === undefined
        ? null
        : { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
    }
    const at = nodeCanvasPosition(deck, id);
    if (at === null) return null;
    const size = cardSize(node, level);
    return { x: at.x + size.width / 2, y: at.y + size.height / 2 };
  };
  const from = centre(fromId);
  const to = centre(toId);
  if (from === null || to === null) return null;
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}

/**
 * A component the current view hides (011 FR-016): stays in the view (clarification Q7) and offers
 * the first view that shows it instead. Returns whether it handled the result.
 */
function offerShowInView(node: { id: string; title: string }, context: OpenResultContext): boolean {
  if (context.isHidden?.(node.id) !== true) return false;
  const view = context.firstViewShowing?.(node.id) ?? null;
  if (view === null) {
    context.showToast?.(`${node.title} is hidden in every view`);
  } else {
    context.showToast?.(`${node.title} is hidden in this view`, {
      label: `Show in ${view.title}`,
      onAction: () => {
        selectView(view);
        context.select({ nodes: [node.id] });
        context.focus(node.id);
      },
    });
  }
  return true;
}

/**
 * A table inside a collapsed schema group (048 FR-022): stays collapsed and offers "Expand schema",
 * which expands the group and then opens the result. Returns whether it handled the result.
 */
function offerExpandSchema(
  node: { id: string; title: string },
  result: PaletteResult,
  context: OpenResultContext,
): boolean {
  const schema = context.collapsedSchemaOf?.(node.id) ?? null;
  if (schema === null) return false;
  context.showToast?.(`${node.title} is in the collapsed schema ${schema.title}`, {
    label: 'Expand schema',
    onAction: () => {
      setGroupCollapsed(context.editor, schema.groupId, false);
      openResult(result, context);
    },
  });
  return true;
}

/**
 * Jump to a column (048 FR-021): a row the limit cut opens the table as Show all (saved, one undo
 * step, also when locked), the table and row are selected, and the canvas centres on the row. Rows
 * are not drawn at System and Landscape zoom, so those go to 100 %.
 */
function jumpToColumn(
  result: PaletteResult,
  tableId: string,
  columnId: string,
  context: OpenResultContext,
): boolean {
  const table = readDeck(context.editor.doc).nodes.find((entry) => entry.id === tableId);
  if (table?.columns?.some((entry) => entry.id === columnId) !== true) return false;
  if (offerShowInView(table, context) || offerExpandSchema(table, result, context)) return true;
  const state = useUiStore.getState();
  const drawn = readViewState(context.editor.doc).deck.nodes.find((entry) => entry.id === tableId);
  const cut = drawn === undefined ? undefined : tableLayoutOf(drawn);
  if (cut?.hidden?.kind === 'limit' && cut.hiddenIds.has(columnId)) {
    oneStep(context.editor, () => {
      context.editor.update('nodes', tableId, { expanded: true });
    });
  }
  context.select({ nodes: [tableId] });
  context.focus(tableId);
  state.setFocusedRow({ tableId, columnId });
  // One frame, so the opened table is the one measured.
  requestAnimationFrame(() => {
    const view = readViewState(context.editor.doc).deck;
    const node = view.nodes.find((entry) => entry.id === tableId);
    const at = nodeCanvasPosition(view, tableId);
    if (node === undefined || at === null) return;
    const layout = tableLayoutOf(node);
    const zoom = context.getZoom();
    context.setCenter(at.x + layout.width / 2, at.y + rowAnchorY(layout, columnId).y, {
      zoom: rowsDrawn(levelForZoom(zoom)) ? zoom : 1,
    });
    // The row is the selection: it takes keyboard focus once it is drawn, so ↓ ↑ ⏎ work from it.
    focusRowSoon({ tableId, columnId });
  });
  return true;
}

export function openResult(result: PaletteResult, context: OpenResultContext): boolean {
  const deck = readDeck(context.editor.doc);
  switch (result.kind) {
    case 'command':
      result.run?.();
      return result.run !== undefined;
    case 'node':
    case 'table': {
      const node = deck.nodes.find((entry) => entry.id === result.id);
      if (node === undefined) break;
      ensureCanvasReady(result, context);
      if (offerShowInView(node, context) || offerExpandSchema(node, result, context)) return true;
      context.select(selectionFor(result));
      context.focus(result.id);
      context.fitView({
        nodes: [{ id: result.id }],
        duration: 0,
        maxZoom: Math.max(context.getZoom(), 1),
      });
      return true;
    }
    case 'column': {
      if (result.tableId === undefined) break;
      ensureCanvasReady(result, context);
      if (!jumpToColumn(result, result.tableId, result.id, context)) break;
      return true;
    }
    case 'edge': {
      const edge = deck.edges.find((entry) => entry.id === result.id);
      const center =
        edge === undefined ? null : edgeCenter(deck, edge.from, edge.to, context.getZoom());
      if (edge === undefined || center === null) break;
      ensureCanvasReady(result, context);
      context.select(selectionFor(result));
      context.setCenter(center.x, center.y, { zoom: context.getZoom() });
      return true;
    }
    case 'sticky': {
      const sticky = deck.stickies.find((entry) => entry.id === result.id);
      if (sticky === undefined) break;
      ensureCanvasReady(result, context);
      const point = stickyCanvasPosition(deck, sticky).point;
      context.select(selectionFor(result));
      context.setCenter(point.x, point.y, { zoom: context.getZoom() });
      return true;
    }
    case 'image': {
      const image = deck.images?.find((entry) => entry.id === result.id);
      if (image === undefined) break;
      ensureCanvasReady(result, context);
      const box = imageBox(image);
      context.select(selectionFor(result));
      context.setCenter(box.x + box.width / 2, box.y + box.height / 2, {
        zoom: context.getZoom(),
      });
      return true;
    }
    case 'flow': {
      const flow = deck.flows.find((entry) => entry.id === result.id);
      if (flow === undefined) break;
      if (context.screen === 'rules') context.navigateToCanvas();
      context.openFlow(context.editor, flow.id);
      return true;
    }
    case 'step': {
      const flow = deck.flows.find((entry) => entry.id === result.flowId);
      const step = flow?.steps.find((entry) => entry.id === result.id);
      if (flow === undefined || step === undefined) break;
      if (context.screen === 'rules') context.navigateToCanvas();
      context.openFlow(context.editor, flow.id, step.id);
      return true;
    }
    case 'rule':
      if (deck.rules[result.id] === undefined) break;
      context.openRules(result.id);
      return true;
  }
  context.announce('This item no longer exists');
  return false;
}

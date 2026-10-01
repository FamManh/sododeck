import { nodeCanvasPosition, stickyCanvasPosition, type DeckEditor } from '@sododeck/model';
import type { View } from '@sododeck/schema';

import { readDeck } from '../../model/use-deck-snapshot';
import { isFlowMode, type Selection, type UiState, useUiStore } from '../../state/ui-store';
import { cardSize } from '../canvas-geometry';
import { levelForZoom } from '../levels';
import { selectView } from '../views/use-current-view';

import type { PaletteResult } from './palette-results';

type CanvasKind = 'node' | 'edge' | 'flow' | 'step' | 'sticky';

function isCanvasKind(kind: PaletteResult['kind']): kind is CanvasKind {
  return (
    kind === 'node' || kind === 'edge' || kind === 'flow' || kind === 'step' || kind === 'sticky'
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
  /** Shows a toast, with an optional action that takes focus. */
  showToast?: (message: string, action?: { label: string; onAction: () => void }) => void;
}

function selectionFor(result: PaletteResult): Partial<Selection> {
  switch (result.kind) {
    case 'node':
      return { nodes: [result.id] };
    case 'edge':
      return { edges: [result.id] };
    case 'sticky':
      return { stickies: [result.id] };
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

/** The midpoint of an edge's two endpoint cards, each sized by its own stored size (017 R2). */
export function edgeCenter(
  deck: ReturnType<typeof readDeck>,
  fromId: string,
  toId: string,
  zoom: number,
): { x: number; y: number } | null {
  const from = nodeCanvasPosition(deck, fromId);
  const to = nodeCanvasPosition(deck, toId);
  const fromNode = deck.nodes.find((n) => n.id === fromId);
  const toNode = deck.nodes.find((n) => n.id === toId);
  if (from === null || to === null || fromNode === undefined || toNode === undefined) return null;
  const level = levelForZoom(zoom);
  const fromSize = cardSize(fromNode, level);
  const toSize = cardSize(toNode, level);
  return {
    x: (from.x + fromSize.width / 2 + (to.x + toSize.width / 2)) / 2,
    y: (from.y + fromSize.height / 2 + (to.y + toSize.height / 2)) / 2,
  };
}

export function openResult(result: PaletteResult, context: OpenResultContext): boolean {
  const deck = readDeck(context.editor.doc);
  switch (result.kind) {
    case 'command':
      result.run?.();
      return result.run !== undefined;
    case 'node': {
      const node = deck.nodes.find((entry) => entry.id === result.id);
      if (node === undefined) break;
      ensureCanvasReady(result, context);
      if (context.isHidden?.(node.id) === true) {
        // Stay in the view (clarification Q7): offer the first view that shows it instead.
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
      context.select(selectionFor(result));
      context.focus(result.id);
      context.fitView({
        nodes: [{ id: result.id }],
        duration: 0,
        maxZoom: Math.max(context.getZoom(), 1),
      });
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

import { nodeCanvasPosition, stickyCanvasPosition, type DeckEditor } from '@sododeck/model';

import { readDeck } from '../../model/use-deck-snapshot';
import { isFlowMode, type Selection, type UiState, useUiStore } from '../../state/ui-store';
import { NODE_SIZE } from '../canvas-geometry';

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
      const from = edge === undefined ? null : nodeCanvasPosition(deck, edge.from);
      const to = edge === undefined ? null : nodeCanvasPosition(deck, edge.to);
      if (edge === undefined || from === null || to === null) break;
      ensureCanvasReady(result, context);
      context.select(selectionFor(result));
      context.setCenter(
        (from.x + to.x + NODE_SIZE.width) / 2,
        (from.y + to.y + NODE_SIZE.height) / 2,
        {
          zoom: context.getZoom(),
        },
      );
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

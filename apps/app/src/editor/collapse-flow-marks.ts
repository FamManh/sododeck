import type { SododeckFile } from '@sododeck/schema';

import type { EdgeFlowMark, FlowOverlay } from './flows/flow-overlay';
import type { PlayedPath } from './flows/played-path';
import type { VisibleGraph } from './visible-graph';

export interface CollapsedFlowMarks {
  merged: ReadonlyMap<string, EdgeFlowMark>;
  cards: ReadonlyMap<string, 'current' | 'path'>;
}

const EMPTY_COLLAPSED_FLOW_MARKS: CollapsedFlowMarks = {
  merged: new Map(),
  cards: new Map(),
};

export function collapseFlowMarks(overlay: FlowOverlay, graph: VisibleGraph): CollapsedFlowMarks {
  if (graph.merged.length === 0 && graph.cards.length === 0) {
    return EMPTY_COLLAPSED_FLOW_MARKS;
  }
  if (overlay.edges.size === 0) return EMPTY_COLLAPSED_FLOW_MARKS;

  const merged = new Map<string, EdgeFlowMark>();
  const cards = new Map<string, 'current' | 'path'>();

  for (const mergedEdge of graph.merged) {
    const edgeMarks = mergedEdge.edgeIds
      .map((edgeId) => overlay.edges.get(edgeId))
      .filter((mark): mark is EdgeFlowMark => mark !== undefined);
    if (edgeMarks.length === 0) continue;
    merged.set(mergedEdge.id, {
      badges: edgeMarks.flatMap((mark) => mark.badges),
      style: edgeMarks.every((mark) => mark.style === 'error') ? 'error' : 'path',
      errorIcon: edgeMarks.some((mark) => mark.errorIcon),
      inPath: edgeMarks.some((mark) => mark.inPath === true),
      current: edgeMarks.find((mark) => mark.current != null)?.current ?? null,
    });
  }

  for (const card of graph.cards) {
    const hiddenMarks = card.hiddenEdges
      .map((edgeId) => overlay.edges.get(edgeId))
      .filter((mark): mark is EdgeFlowMark => mark !== undefined);
    if (hiddenMarks.some((mark) => mark.current != null)) {
      cards.set(card.groupId, 'current');
    } else if (hiddenMarks.some((mark) => mark.inPath === true)) {
      cards.set(card.groupId, 'path');
    }
  }

  return { merged, cards };
}

export function groupAtStep(
  deck: SododeckFile,
  graph: VisibleGraph,
  edgeId: string,
): string | null {
  const card = graph.cards.find((entry) => entry.hiddenEdges.includes(edgeId));
  if (card === undefined) return null;
  return deck.groups.find((group) => group.id === card.groupId)?.title ?? null;
}

export function stepForGroup(
  played: PlayedPath,
  graph: VisibleGraph,
  groupId: string,
): string | null {
  const card = graph.cards.find((entry) => entry.groupId === groupId);
  if (card === undefined) return null;
  return played.steps.find((step) => card.hiddenEdges.includes(step.step.edge))?.step.id ?? null;
}

export function stepForEdges(
  played: PlayedPath,
  edgeIds: readonly string[],
  currentStepId: string | null,
): string | null {
  const allowed = new Set(edgeIds);
  const total = played.steps.length;
  const start = currentStepId === null ? -1 : (played.index.get(currentStepId) ?? -1);
  for (let offset = 1; offset <= total; offset++) {
    const step = played.steps[(start + offset + total) % total];
    if (step !== undefined && allowed.has(step.step.edge)) return step.step.id;
  }
  return null;
}

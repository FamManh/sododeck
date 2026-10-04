import type { SododeckFile } from '@sododeck/schema';

import { mergeChips, type TouchChip } from '../db/touches';
import type { EdgeFlowMark, FlowOverlay } from './flows/flow-overlay';
import type { PlayedPath } from './flows/played-path';
import type { StepState } from './flows/step-marks';
import type { VisibleGraph } from './visible-graph';

export interface CollapsedFlowMarks {
  merged: ReadonlyMap<string, EdgeFlowMark>;
  /** Folded step state of each collapsed group's front card: current > played > upcoming. */
  cards: ReadonlyMap<string, StepState>;
  /** The number the folded sticker prints (current and upcoming only; played shows a check). */
  cardNumbers: ReadonlyMap<string, string>;
  /** The database cards' step chips (049) merged onto their collapsed group's card. */
  chips?: ReadonlyMap<string, TouchChip>;
}

/** Same as `visible-graph`'s collapsed card prefix. */
const COLLAPSED_PREFIX = 'collapsed:';

const EMPTY_COLLAPSED_FLOW_MARKS: CollapsedFlowMarks = {
  merged: new Map(),
  cards: new Map(),
  cardNumbers: new Map(),
};

export function collapseFlowMarks(overlay: FlowOverlay, graph: VisibleGraph): CollapsedFlowMarks {
  if (graph.merged.length === 0 && graph.cards.length === 0) {
    return EMPTY_COLLAPSED_FLOW_MARKS;
  }
  if (overlay.edges.size === 0) return EMPTY_COLLAPSED_FLOW_MARKS;
  const chips = collapsedChips(overlay, graph);

  const merged = new Map<string, EdgeFlowMark>();
  const cards = new Map<string, StepState>();
  const cardNumbers = new Map<string, string>();

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
      ...stateOf(edgeMarks),
      current: edgeMarks.find((mark) => mark.current != null)?.current ?? null,
    });
  }

  for (const card of graph.cards) {
    const hiddenMarks = card.hiddenEdges
      .map((edgeId) => overlay.edges.get(edgeId))
      .filter((mark): mark is EdgeFlowMark => mark !== undefined);
    const state = foldState(hiddenMarks);
    if (state === undefined) continue;
    cards.set(card.groupId, state);
    const number = numberOf(hiddenMarks, state);
    if (number !== undefined) cardNumbers.set(card.groupId, number);
  }

  return { merged, cards, cardNumbers, ...(chips.size === 0 ? {} : { chips }) };
}

/** Chips of database cards hidden in a collapsed group, merged per group in deck order (049). */
function collapsedChips(overlay: FlowOverlay, graph: VisibleGraph): Map<string, TouchChip> {
  const byGroup = new Map<string, TouchChip[]>();
  for (const [nodeId, drawn] of graph.representative) {
    if (!drawn.startsWith(COLLAPSED_PREFIX)) continue;
    const chip = overlay.nodes.get(nodeId)?.chip;
    if (chip === undefined) continue;
    const groupId = drawn.slice(COLLAPSED_PREFIX.length);
    byGroup.set(groupId, [...(byGroup.get(groupId) ?? []), chip]);
  }
  const out = new Map<string, TouchChip>();
  for (const [groupId, chips] of byGroup) {
    const merged = mergeChips(chips);
    if (merged !== null) out.set(groupId, merged);
  }
  return out;
}

/** current > played > upcoming over the marks on the path; `undefined` when none is. */
function foldState(marks: readonly EdgeFlowMark[]): StepState | undefined {
  const onPath = marks.filter((mark) => mark.inPath === true);
  if (onPath.some((mark) => mark.current != null || mark.state === 'current')) return 'current';
  if (onPath.some((mark) => mark.state === 'played')) return 'played';
  return onPath.length > 0 ? 'upcoming' : undefined;
}

/** The step number a folded sticker prints: the current step's, or the earliest upcoming one. */
function numberOf(marks: readonly EdgeFlowMark[], state: StepState): string | undefined {
  if (state === 'played') return undefined;
  if (state === 'current') return marks.find((mark) => mark.current != null)?.current?.number;
  const upcoming = marks
    .filter((mark) => mark.inPath === true && mark.state === 'upcoming')
    .flatMap((mark) => mark.badges.map((badge) => badge.label));
  return upcoming.sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b))[0];
}

function stateOf(marks: readonly EdgeFlowMark[]): { state?: StepState } {
  const state = foldState(marks);
  return state === undefined ? {} : { state };
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

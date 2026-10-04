/**
 * Canvas marks of the shown or recorded flow (006 research R6): numbered badges, path, error-path,
 * candidate, preview and invalid styles on edges, and the "Step n starts here" ring on the next
 * start node; in flow mode (007) the played path, the current edge and its nodes. Pure; `toFlowEdges` / `toFlowNodes` read it through their per-object cache.
 */
import type { FlowAnalysis, PathStep, TouchAccess } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

import { cardChip, type TouchChip } from '../../db/touches';
import { isDatabaseCard } from '../../db/owner';
import type { FlowSession } from '../../state/ui-store';
import { sessionPath } from './session-path';
import { edgeStateOf, stepMarks, type NodeStepMark, type StepState } from './step-marks';

export interface EdgeBadge {
  /** Step number, e.g. "3" or "4b". */
  label: string;
  errorPath: boolean;
  /** The active step. */
  current: boolean;
  /** The step does not start where the previous one ended (FR-021). */
  chainBreak: boolean;
}

export type EdgeFlowStyle = 'path' | 'error' | 'candidate' | 'preview' | 'invalid';

export interface EdgeFlowMark {
  /** One per step that travels the edge, in path order. */
  badges: readonly EdgeBadge[];
  style: EdgeFlowStyle;
  /** An error-path step travels the edge: the label gets an alert icon (FR-026). */
  errorIcon: boolean;
  /** Flow mode: a played step travels the edge (not dimmed). Absent outside flow mode. */
  inPath?: boolean;
  /** Flow mode: played / current / upcoming, for the connector stroke (035). */
  state?: StepState;
  /** Flow mode: the current step's edge (thicker, filled label, numbered token). */
  current?: { speed: 1 | 2; number: string } | null;
}

export interface NodeFlowMark {
  /** "Step 4 starts here" (recording only). */
  startsHere?: string;
  /** Flow mode: from/to of a played step. */
  inPath?: boolean;
  /** Flow mode: the target card of the current step (lift + `aria-current="step"`). */
  currentStep?: boolean;
  /** Flow mode: the card's sticker (035); absent for cards the played path does not touch. */
  step?: NodeStepMark | null;
  /** Flow mode (049): a table the current step reads or writes (write beats read). */
  touch?: TouchAccess;
  /** Flow mode (049): the columns of this table the current step touches. */
  columns?: ReadonlyMap<string, TouchAccess>;
  /** Flow mode (049): a database card owning touched tables, "writes orders +1". */
  chip?: TouchChip;
}

/** Flow mode input (007 data-model §3). */
export interface PlaybackMarks {
  /** Ids of the played steps. */
  played: ReadonlySet<string>;
  currentStepId: string | null;
  speed: 1 | 2;
}

export interface FlowOverlay {
  edges: ReadonlyMap<string, EdgeFlowMark>;
  nodes: ReadonlyMap<string, NodeFlowMark>;
}

export const EMPTY_OVERLAY: FlowOverlay = { edges: new Map(), nodes: new Map() };

/** Marks for `analysis` (the shown flow) and, during a session, its next step. */
export function flowOverlay(
  deck: SododeckFile,
  analysis: FlowAnalysis | null,
  session: FlowSession | null,
  hoverEdgeId: string | null,
  activeStepId: string | null = null,
  playback: PlaybackMarks | null = null,
): FlowOverlay {
  const badges = new Map<string, EdgeBadge[]>();
  if (analysis !== null) {
    const paths = [
      { steps: analysis.main, errorPath: false },
      ...analysis.branches.map((b) => ({ steps: b.steps, errorPath: b.branch.errorPath === true })),
    ];
    for (const { steps, errorPath } of paths) {
      for (const s of steps) {
        if (s.broken) continue;
        const list = badges.get(s.step.edge) ?? [];
        list.push({
          label: s.number,
          errorPath,
          current: s.step.id === activeStepId,
          chainBreak: s.chainBreak,
        });
        badges.set(s.step.edge, list);
      }
    }
  }

  const edges = new Map<string, EdgeFlowMark>();
  for (const [edgeId, list] of badges) {
    const allError = list.every((b) => b.errorPath);
    edges.set(edgeId, {
      badges: list,
      style: allError ? 'error' : 'path',
      errorIcon: list.some((b) => b.errorPath),
    });
  }

  const nodes = new Map<string, NodeFlowMark>();
  if (playback !== null && analysis !== null) {
    markPlayback(analysis, playback, edges, nodes);
    markTouches(deck, analysis, playback, nodes);
  }
  if (session === null) return { edges, nodes };

  const path = sessionPath(analysis, session.target);
  const mark = (edgeId: string, style: EdgeFlowStyle) => {
    const existing = edges.get(edgeId);
    edges.set(edgeId, {
      badges: existing?.badges ?? [],
      errorIcon: existing?.errorIcon ?? false,
      style,
    });
  };
  if (path.nextStart !== null) {
    nodes.set(path.nextStart, { startsHere: `Step ${path.nextNumber} starts here` });
    for (const edge of deck.edges) {
      if (edge.from === path.nextStart && !edges.has(edge.id)) mark(edge.id, 'candidate');
    }
  }
  if (hoverEdgeId !== null) {
    const edge = deck.edges.find((e) => e.id === hoverEdgeId);
    const valid = edge !== undefined && (path.nextStart === null || edge.from === path.nextStart);
    if (valid) mark(hoverEdgeId, 'preview');
  }
  if (session.invalid !== null) mark(session.invalid.edgeId, 'invalid');
  return { edges, nodes };
}

const EDGE_RANK: Record<StepState, number> = { upcoming: 0, played: 1, current: 2 };

function markPlayback(
  analysis: FlowAnalysis,
  playback: PlaybackMarks,
  edges: Map<string, EdgeFlowMark>,
  nodes: Map<string, NodeFlowMark>,
): void {
  for (const [edgeId, mark] of edges) edges.set(edgeId, { ...mark, inPath: false, current: null });
  // `played` is built in path order, so the set's order is the order of the steps.
  const steps = [...playback.played].flatMap((id) => analysis.byStepId.get(id) ?? []);
  const currentIndex = steps.findIndex((s) => s.step.id === playback.currentStepId);
  steps.forEach((s, k) => {
    markStepEdge(s, edgeStateOf(k, currentIndex), playback, edges);
  });
  for (const s of steps) {
    if (s.broken) continue;
    for (const nodeId of [s.from, s.to]) {
      if (nodeId !== null) nodes.set(nodeId, { inPath: true, currentStep: false, step: null });
    }
  }
  for (const [nodeId, step] of stepMarks(steps, currentIndex)) {
    nodes.set(nodeId, { inPath: true, currentStep: step.state === 'current', step });
  }
}

/**
 * What the current step reads or writes (049): each touched table gets its access and touched
 * columns (its `current` sticker comes from `stepMarks`), and each database card owning a touched
 * table its chip ("writes orders +1"). Whichever is drawn at the current level shows.
 */
function markTouches(
  deck: SododeckFile,
  analysis: FlowAnalysis,
  playback: PlaybackMarks,
  nodes: Map<string, NodeFlowMark>,
): void {
  const step =
    playback.currentStepId === null
      ? undefined
      : analysis.byStepId.get(playback.currentStepId)?.step;
  const touches = step?.touches;
  if (step === undefined || touches === undefined || touches.length === 0) return;
  const columns = new Map<string, Map<string, TouchAccess>>();
  const tables = new Map<string, TouchAccess>();
  for (const touch of touches) {
    if (tables.get(touch.table) !== 'write') tables.set(touch.table, touch.access);
    if (touch.column === undefined) continue;
    const own = columns.get(touch.table) ?? new Map<string, TouchAccess>();
    own.set(touch.column, touch.access);
    columns.set(touch.table, own);
  }
  for (const [tableId, access] of tables) {
    const mark = nodes.get(tableId) ?? { inPath: true, currentStep: true, step: null };
    const own = columns.get(tableId);
    nodes.set(tableId, { ...mark, touch: access, ...(own === undefined ? {} : { columns: own }) });
  }
  for (const card of deck.nodes) {
    if (!isDatabaseCard(card)) continue;
    const chip = cardChip(deck, card.id, step);
    if (chip === null) continue;
    nodes.set(card.id, {
      ...(nodes.get(card.id) ?? { currentStep: false, step: null }),
      inPath: true,
      chip,
    });
  }
}

function markStepEdge(
  s: PathStep,
  state: StepState,
  playback: PlaybackMarks,
  edges: Map<string, EdgeFlowMark>,
): void {
  const mark = edges.get(s.step.edge);
  if (s.broken || mark === undefined) return;
  const isCurrent = s.step.id === playback.currentStepId;
  // An edge several steps travel shows the most advanced of their states.
  const known = mark.state;
  const next = known === undefined || EDGE_RANK[state] > EDGE_RANK[known] ? state : known;
  edges.set(s.step.edge, {
    ...mark,
    inPath: true,
    state: next,
    current: isCurrent ? { speed: playback.speed, number: s.number } : (mark.current ?? null),
  });
}

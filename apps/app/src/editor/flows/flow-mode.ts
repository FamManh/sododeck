/**
 * Flow mode actions (007 research R1, R2, R12): open, exit, step, switch alternative. The store
 * holds ids and play state; everything here reads the deck through the editor, resolves the played
 * path and announces the new current step exactly once. React-free, so tests drive them against a
 * real editor.
 */
import { analyzeFlow, type DeckEditor, type FlowAnalysis } from '@sododeck/model';
import type { Flow, SododeckFile } from '@sododeck/schema';

import { readDeck } from '../../model/use-deck-snapshot';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import { groupAtStep } from '../collapse-flow-marks';
import {
  currentOf,
  playedPath,
  playerView,
  rehome,
  stepAnnouncement,
  type PlayedPath,
  type PlayerView,
} from './played-path';
import { findFlow } from './session-path';
import { scopeOf, visibleGraph } from '../visible-graph';

const ui = () => useUiStore.getState();

export interface Playback {
  flow: Flow;
  analysis: FlowAnalysis;
  played: PlayedPath;
  /** `null` for an empty flow. */
  view: PlayerView | null;
  currentStepId: string | null;
}

/** The open flow in flow mode, derived from the deck and the store; `null` outside flow mode. */
export function currentPlayback(deck: SododeckFile): Playback | null {
  const state = ui();
  const active = state.activeFlow;
  if (active === null || !isFlowMode(state)) return null;
  const flow = findFlow(deck, active.flowId);
  if (flow === undefined) return null;
  return playbackOf(deck, flow, active.alternativeId, active.stepId);
}

export function playbackOf(
  deck: SododeckFile,
  flow: Flow,
  alternativeId: string | null,
  stepId: string | null,
): Playback {
  const analysis = analyzeFlow(flow, deck.edges);
  const played = playedPath(analysis, alternativeId);
  const view = playerView(analysis, played, stepId);
  const currentStepId = currentOf(played, stepId)?.step.id ?? null;
  return { flow, analysis, played, view, currentStepId };
}

function announceStep(deck: SododeckFile, playback: Playback, stepId: string | null): void {
  const step = currentOf(playback.played, stepId);
  if (step !== null) {
    const state = useUiStore.getState();
    const graph = visibleGraph(deck, scopeOf(state.drill), state.collapsed);
    ui().announce(
      stepAnnouncement(
        deck,
        playback.played,
        step,
        groupAtStep(deck, graph, step.step.edge) ?? undefined,
      ),
    );
  }
}

/**
 * Enters flow mode on `stepId` (its alternative chosen), else on step 1 of the played path. Pass
 * `announce: false` when the caller announces something else (e.g. "Saved flow").
 */
export function openFlow(
  editor: DeckEditor,
  flowId: string,
  stepId: string | null = null,
  options: { announce?: boolean } = {},
): void {
  const deck = readDeck(editor.doc);
  const flow = findFlow(deck, flowId);
  if (flow === undefined) return;
  const drilled = useUiStore.getState().drill.length > 0;
  const analysis = analyzeFlow(flow, deck.edges);
  const alternativeId = (stepId === null ? null : analysis.byStepId.get(stepId)?.branchId) ?? null;
  const playback = playbackOf(deck, flow, alternativeId, stepId);
  ui().openFlow(flowId, playback.currentStepId, alternativeId);
  if (options.announce === false) return;
  if (drilled) {
    ui().announce('Showing the whole deck for this flow');
    return;
  }
  announceStep(deck, playback, playback.currentStepId);
}

export function exitFlow(): void {
  ui().exitFlow();
}

/** Makes a step current (pausing); a step on another alternative switches to it. */
export function goToStep(editor: DeckEditor, stepId: string): void {
  const deck = readDeck(editor.doc);
  const playback = currentPlayback(deck);
  if (playback === null) return;
  const target = playback.analysis.byStepId.get(stepId);
  if (target === undefined) return;
  const active = ui().activeFlow;
  if (target.branchId !== null && target.branchId !== playback.played.alternative?.branch.id) {
    ui().setAlternative(target.branchId, stepId);
    const next = playbackOf(deck, playback.flow, target.branchId, stepId);
    announceStep(deck, next, stepId);
    return;
  }
  if (active?.stepId === stepId && !active.playing) return;
  ui().setCurrentStep(stepId);
  announceStep(deck, playback, stepId);
}

export function nextStep(editor: DeckEditor): void {
  const next = currentPlayback(readDeck(editor.doc))?.view?.next;
  if (next != null) goToStep(editor, next);
  else ui().setPlaying(false);
}

export function previousStep(editor: DeckEditor): void {
  const previous = currentPlayback(readDeck(editor.doc))?.view?.previous;
  if (previous != null) goToStep(editor, previous);
  else ui().setPlaying(false);
}

/** Chooses the next / previous alternative (wrapping) or a given one, re-homing the current step. */
export function switchAlternative(editor: DeckEditor, to: 1 | -1 | string): void {
  const deck = readDeck(editor.doc);
  const playback = currentPlayback(deck);
  if (playback === null || playback.view?.showPicker !== true) return;
  const branches = playback.analysis.branches;
  const at = branches.findIndex((b) => b.branch.id === playback.played.alternative?.branch.id);
  const target =
    typeof to === 'string'
      ? branches.find((b) => b.branch.id === to)
      : branches[(at + to + branches.length) % branches.length];
  if (target === undefined || target.branch.id === playback.played.alternative?.branch.id) return;
  const stepId = rehome(playback.analysis, target.branch.id, playback.currentStepId);
  ui().setAlternative(target.branch.id, stepId);
  announceStep(deck, playbackOf(deck, playback.flow, target.branch.id, stepId), stepId);
}

/** Autoplay tick: the next step becomes current while playing; stops on the last step. */
export function advancePlayback(editor: DeckEditor): void {
  const deck = readDeck(editor.doc);
  const playback = currentPlayback(deck);
  const next = playback?.view?.next ?? null;
  if (playback === null || next === null) {
    ui().setPlaying(false);
    return;
  }
  ui().advance(next);
  if (playback.played.steps.at(-1)?.step.id === next) ui().setPlaying(false);
  announceStep(deck, playback, next);
}

/** Play: on the last step restarts at step 1 (FR-011). */
export function play(editor: DeckEditor): void {
  const deck = readDeck(editor.doc);
  const playback = currentPlayback(deck);
  if (playback?.view == null) return;
  if (playback.view.next === null) {
    const first = playback.played.steps[0]?.step.id;
    if (first === undefined) return;
    ui().setCurrentStep(first);
    announceStep(deck, playback, first);
  }
  ui().setPlaying(true);
}

/**
 * Recording and edit-session actions (006 data-model §3, research R3, R4, R9). Every document
 * change goes through the editor (so it autosaves, syncs and undoes); the session in the UI store
 * only holds ids, mode and notices. React-free, so tests drive them against a real editor.
 */
import {
  analyzeFlow,
  captureFlowStructure,
  DeckEditError,
  flowStructureChanged,
  type DeckEditor,
  type FlowAnalysis,
} from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

import { readDeck } from '../../model/use-deck-snapshot';
import { useUiStore, type FlowSession } from '../../state/ui-store';
import { recordEdge, type RecordResult } from './record-edge';
import { findFlow, nodeTitle, sessionPath } from './session-path';

const ui = () => useUiStore.getState();

/** The analysis of the session's (or shown) flow, or null before its first step. */
export function analysisOf(deck: SododeckFile, flowId: string | null): FlowAnalysis | null {
  const flow = findFlow(deck, flowId);
  return flow === undefined ? null : analyzeFlow(flow, deck.edges);
}

/** Title shown in the chip: the flow's current title, or the name typed at "+ New flow". */
export function sessionTitle(deck: SododeckFile, session: FlowSession): string {
  return findFlow(deck, session.flowId)?.title ?? session.pendingTitle;
}

function route(deck: SododeckFile, edgeId: string): string {
  const edge = deck.edges.find((e) => e.id === edgeId);
  if (edge === undefined) return 'Unknown connection';
  return `${nodeTitle(deck, edge.from)} → ${nodeTitle(deck, edge.to)}`;
}

/** "+ New flow": starts recording; the flow is created with its first step (research R3). */
export function startNewFlow(title: string, featureId: string | null): void {
  ui().startRecording(title.trim(), featureId);
  ui().announce(`Recording ‘${title.trim()}’. Click a connection to add step 1.`);
}

/** "Edit steps": captures the structure so Cancel can restore it (clarification Q1). */
export function startEditing(editor: DeckEditor, flowId: string): void {
  const deck = readDeck(editor.doc);
  const flow = findFlow(deck, flowId);
  if (flow === undefined) return;
  ui().startEditing(flowId, captureFlowStructure(deck, flowId));
  // After a fork, new steps go to the end of an alternative (FR-030).
  const last = flow.branches?.at(-1);
  if (last !== undefined) ui().setTarget({ kind: 'branch', branchId: last.id });
  ui().announce(`Editing ‘${flow.title}’`);
}

/** A click (or Enter) on an edge during a session. Returns what happened, or null. */
export function recordClick(editor: DeckEditor, edgeId: string): RecordResult | null {
  const session = ui().flowSession;
  if (session === null) return null;
  const deck = readDeck(editor.doc);
  const result = recordEdge(deck, session, edgeId);
  if (result === null) return null;

  if (result.kind === 'invalid') {
    ui().setInvalid({
      edgeId,
      stepNumber: result.stepNumber,
      branchFromStep: result.branchFromStep,
    });
    const start = sessionPath(analysisOf(deck, session.flowId), session.target).nextStart;
    ui().announce(
      `Can't add ${route(deck, edgeId)} as step ${result.stepNumber}. It doesn't start at ${nodeTitle(deck, start)}.`,
    );
    return result;
  }

  let flowId = session.flowId;
  let stepId: string;
  if (result.kind === 'create') {
    // One batch: the flow and its first step are one undo step.
    [flowId, stepId] = editor.batch(() => {
      const id = editor.add('flows', {
        title: result.title,
        ...(result.featureId === null ? {} : { feature: result.featureId }),
      });
      return [id, editor.appendStep(id, null, { edge: result.edge })] as const;
    });
    ui().setSessionFlow(flowId);
  } else {
    if (flowId === null) return null;
    stepId = editor.appendStep(flowId, result.branchId, { edge: result.edge });
  }
  ui().pushRecorded(stepId);
  ui().setInvalid(null);
  const number = analysisOf(readDeck(editor.doc), flowId)?.byStepId.get(stepId)?.number ?? '';
  ui().announce(`Step ${number} added: ${route(deck, edgeId)}`);
  return result;
}

/** ⌘Z / "Undo last step" during a session (FR-014): removes the last recorded step. */
export function undoLastStep(editor: DeckEditor): boolean {
  const session = ui().flowSession;
  const last = session?.recorded.at(-1);
  if (session?.flowId == null || last === undefined) return false;
  const number = analysisOf(readDeck(editor.doc), session.flowId)?.byStepId.get(last)?.number;
  try {
    editor.removeStep(session.flowId, last);
  } catch (error) {
    // Already gone (e.g. removed with ⌫ or from another tab): just forget it.
    if (!(error instanceof DeckEditError)) throw error;
  }
  ui().popRecorded();
  ui().setInvalid(null);
  if (number !== undefined) ui().announce(`Removed step ${number}`);
  return true;
}

/** Why Done is disabled, or null when the flow can be saved (FR-012). */
export function doneBlocker(deck: SododeckFile, session: FlowSession): string | null {
  const analysis = analysisOf(deck, session.flowId);
  if (analysis === null || analysis.byStepId.size === 0) return 'Add at least one step first.';
  const chainBreak = [...analysis.byStepId.values()].find((s) => s.chainBreak);
  if (chainBreak !== undefined) {
    const { number } = chainBreak;
    return `Step ${number} doesn't start where the previous step ended.`;
  }
  if (
    analysis.problems.some(
      (p) => p.kind === 'empty-branch-label' || p.kind === 'empty-branch-condition',
    )
  ) {
    return 'Every branch needs a label and a condition.';
  }
  return null;
}

/** Done: ends the session and shows the flow. Returns the toast text, or null when blocked. */
export function finish(editor: DeckEditor): string | null {
  const session = ui().flowSession;
  if (session === null) return null;
  const deck = readDeck(editor.doc);
  if (doneBlocker(deck, session) !== null || session.flowId === null) return null;
  const flow = findFlow(deck, session.flowId);
  const count = flow?.steps.length ?? 0;
  const title = flow?.title ?? session.pendingTitle;
  ui().endSession();
  ui().setActiveFlow(session.flowId);
  ui().announce(`Saved flow ‘${title}’`);
  return `Saved flow ‘${title}’ · ${String(count)} ${count === 1 ? 'step' : 'steps'}`;
}

/** Whether Cancel must ask first (FR-013, FR-018): something was recorded or restructured. */
export function cancelNeedsConfirm(deck: SododeckFile, session: FlowSession): boolean {
  if (session.mode === 'record') return (findFlow(deck, session.flowId)?.steps.length ?? 0) > 0;
  return session.checkpoint !== null && flowStructureChanged(deck, session.checkpoint);
}

/**
 * Cancel / Esc (after confirmation when needed). Recording: the new flow is removed. Editing: the
 * structure goes back to the checkpoint; text edits stay (clarification Q1).
 */
export function cancel(editor: DeckEditor): void {
  const session = ui().flowSession;
  if (session === null) return;
  const deck = readDeck(editor.doc);
  const flow = findFlow(deck, session.flowId);
  if (session.mode === 'record') {
    if (flow !== undefined) editor.remove('flows', flow.id);
    ui().endSession();
    ui().setActiveFlow(null);
    ui().announce('Recording cancelled');
    return;
  }
  if (flow !== undefined && session.checkpoint !== null) {
    editor.restoreFlowStructure(flow.id, session.checkpoint);
  }
  ui().endSession();
  ui().setActiveFlow(flow?.id ?? null);
  ui().announce('Editing cancelled');
}

/** Cancel / Esc: asks first when something would be lost, else cancels at once (FR-013). */
export function requestCancel(editor: DeckEditor): void {
  const session = ui().flowSession;
  if (session === null) return;
  if (cancelNeedsConfirm(readDeck(editor.doc), session)) ui().setConfirmingCancel(true);
  else cancel(editor);
}

/** Why a branch cannot start after `stepId` (FR-029, edge case "A second branch point"). */
export function branchRefusal(analysis: FlowAnalysis, stepId: string): string | null {
  const step = analysis.byStepId.get(stepId);
  if (step === undefined) return null;
  if (step.branchId !== null) return 'Branches can only start from the main path.';
  if (analysis.branchStepId !== null && analysis.branchStepId !== stepId) {
    const number = analysis.byStepId.get(analysis.branchStepId)?.number ?? '';
    return `This flow already branches after step ${number}.`;
  }
  return null;
}

/**
 * B on a focused step, "Add branch", or "Add as branch from step k" (FR-022, FR-011): adds the
 * branch (with its first edge, when given) and records the next clicks into it. Returns false and
 * announces why when the step cannot take a branch.
 */
export function startBranch(editor: DeckEditor, stepId: string, firstEdge?: string): boolean {
  const session = ui().flowSession;
  if (session?.flowId == null) return false;
  const deck = readDeck(editor.doc);
  const analysis = analysisOf(deck, session.flowId);
  if (analysis === null) return false;
  const refusal = branchRefusal(analysis, stepId);
  if (refusal !== null) {
    ui().announce(refusal);
    return false;
  }
  const { branchId, stepId: firstStep } = editor.addBranch(session.flowId, stepId, {
    ...(firstEdge === undefined ? {} : { firstEdge }),
  });
  ui().setTarget({ kind: 'branch', branchId });
  ui().setAddingBranch(true);
  ui().setInvalid(null);
  if (firstStep !== null) ui().pushRecorded(firstStep);
  const number = analysis.byStepId.get(stepId)?.number ?? '';
  ui().announce(`Adding a branch after step ${number}. Name it and set its condition.`);
  return true;
}

/** The branch being added and the step it forks after, while `addingBranch`. */
export function addingBranchInfo(
  deck: SododeckFile,
  session: FlowSession,
): { branchId: string; afterNumber: string } | null {
  if (!session.addingBranch || session.target.kind !== 'branch') return null;
  const analysis = analysisOf(deck, session.flowId);
  const fork = analysis?.branchStepId;
  if (analysis === null || fork == null) return null;
  return {
    branchId: session.target.branchId,
    afterNumber: analysis.byStepId.get(fork)?.number ?? '',
  };
}

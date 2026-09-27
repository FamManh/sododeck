import { analyzeFlow, getObject, observeDeck } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { useToast } from '@sododeck/ui/components/toast';
import { useEffect } from 'react';

import { readDeck } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import { playedPath } from './played-path';
import { findFlow } from './session-path';

/** Played step ids of a flow in a deck, for re-homing a removed current step by index. */
function playedIds(deck: SododeckFile, flowId: string, alternativeId: string | null): string[] {
  const flow = findFlow(deck, flowId);
  if (flow === undefined) return [];
  return playedPath(analyzeFlow(flow, deck.edges), alternativeId).steps.map((s) => s.step.id);
}

/**
 * Keeps the shown flow and the session pointing at objects that exist (like `useSelectionSync`
 * for nodes): a flow, step or branch removed here or in another tab (origin `remote`) is dropped
 * from the UI state, and a session whose flow is gone ends with an announcement. In flow mode
 * (007) a removed current step hands over to the step now at its index (or the last), a removed
 * alternative falls back to the first, and a removed flow leaves flow mode with a toast.
 */
export function useFlowSync(): void {
  const editor = useEditor();
  const { toast } = useToast();

  useEffect(() => {
    // The deck seen last: titles of a deleted flow, and where a removed step was played.
    let previous = readDeck(editor.doc);
    return observeDeck(editor.doc, ({ changes }) => {
      if (!changes.some((c) => c.scope === 'flows')) return;
      const ui = useUiStore.getState();
      const before = previous;
      previous = readDeck(editor.doc);
      if (!changes.some((c) => c.kind === 'removed')) return;
      const { activeFlow, flowSession } = ui;
      const titleOf = (id: string) => before.flows.find((f) => f.id === id)?.title ?? '';
      // Read the document itself: the snapshot may update after this listener.
      const flowOf = (id: string) => getObject(editor.doc, 'flows', id);

      if (flowSession?.flowId != null && flowOf(flowSession.flowId) === undefined) {
        ui.endSession();
        ui.setActiveFlow(null);
        ui.announce(`Flow ‘${titleOf(flowSession.flowId)}’ was deleted`);
        return;
      }
      if (activeFlow === null) return;
      const flow = flowOf(activeFlow.flowId);
      const flowMode = isFlowMode(ui);
      if (flow === undefined) {
        if (flowMode) {
          // Not "last played": there is nothing left to go back to.
          useUiStore.setState({ activeFlow: null });
          toast({ message: 'This flow was deleted' });
          ui.announce('This flow was deleted');
        } else {
          ui.setActiveFlow(null);
        }
        return;
      }
      const branches = flow.branches ?? [];
      const alternativeGone =
        activeFlow.alternativeId !== null &&
        !branches.some((b) => b.id === activeFlow.alternativeId);
      const stepGone =
        activeFlow.stepId !== null && !flow.steps.some((s) => s.id === activeFlow.stepId);
      if (flowMode && (stepGone || alternativeGone)) {
        const alternativeId = alternativeGone ? null : activeFlow.alternativeId;
        const deck = readDeck(editor.doc);
        const now = playedIds(deck, flow.id, alternativeId);
        let stepId = stepGone ? null : activeFlow.stepId;
        if (stepId === null || !now.includes(stepId)) {
          const index = playedIds(before, flow.id, activeFlow.alternativeId).indexOf(
            activeFlow.stepId ?? '',
          );
          stepId = now[Math.min(Math.max(index, 0), now.length - 1)] ?? null;
        }
        ui.setAlternative(alternativeId, stepId);
      } else if (stepGone) {
        ui.setActiveStep(null);
      }
      if (activeFlow.branchId !== null && !branches.some((b) => b.id === activeFlow.branchId)) {
        ui.setActiveBranch(null);
      }
    });
  }, [editor.doc, toast]);
}

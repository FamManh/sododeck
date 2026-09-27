import { getObject, observeDeck } from '@sododeck/model';
import { useEffect } from 'react';

import { readDeck } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';

/**
 * Keeps the shown flow and the session pointing at objects that exist (like `useSelectionSync`
 * for nodes): a flow, step or branch removed here or in another tab (origin `remote`) is dropped
 * from the UI state, and a session whose flow is gone ends with an announcement.
 */
export function useFlowSync(): void {
  const editor = useEditor();

  useEffect(() => {
    // Titles seen last, so a deleted flow can still be named.
    let titles = new Map(readDeck(editor.doc).flows.map((f) => [f.id, f.title]));
    return observeDeck(editor.doc, ({ changes }) => {
      if (!changes.some((c) => c.scope === 'flows')) return;
      const ui = useUiStore.getState();
      const previous = titles;
      titles = new Map(readDeck(editor.doc).flows.map((f) => [f.id, f.title]));
      if (!changes.some((c) => c.kind === 'removed')) return;
      const { activeFlow, flowSession } = ui;
      // Read the document itself: the snapshot may update after this listener.
      const flowOf = (id: string) => getObject(editor.doc, 'flows', id);

      if (flowSession?.flowId != null && flowOf(flowSession.flowId) === undefined) {
        ui.endSession();
        ui.setActiveFlow(null);
        ui.announce(`Flow ‘${previous.get(flowSession.flowId) ?? ''}’ was deleted`);
        return;
      }
      if (activeFlow === null) return;
      const flow = flowOf(activeFlow.flowId);
      if (flow === undefined) {
        ui.setActiveFlow(null);
        return;
      }
      if (activeFlow.stepId !== null && !flow.steps.some((s) => s.id === activeFlow.stepId)) {
        ui.setActiveStep(null);
      }
      if (
        activeFlow.branchId !== null &&
        !(flow.branches ?? []).some((b) => b.id === activeFlow.branchId)
      ) {
        ui.setActiveBranch(null);
      }
    });
  }, [editor.doc]);
}

import type { DeckEditor } from '@sododeck/model';
import type { Id } from '@sododeck/schema';

import { oneStep } from '../fields/one-step';
import { readViewState } from './use-current-view';

/**
 * "Add to this view" (048): a table made outside the current view's filter joins the view's
 * `includes`, in one undo step. Nothing else about the filter changes.
 */
export function addToCurrentView(editor: DeckEditor, nodeId: Id): void {
  const { view } = readViewState(editor.doc);
  const current = view.includes ?? [];
  if (current.includes(nodeId)) return;
  oneStep(editor, () => {
    editor.updateView(view.id, { includes: [...current, nodeId] });
  });
}

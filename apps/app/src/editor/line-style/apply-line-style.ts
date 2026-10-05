/**
 * The one write path for connector line style (022): a pick writes only its key to every selected
 * connector, as one undo step, and announces it. The line type keeps 029's "remember for new
 * connectors" behaviour through `applyLineType`.
 */
import type { DeckEditor, EdgeStylePatch } from '@sododeck/model';
import type { EdgeShape, Id } from '@sododeck/schema';

import { useUiStore } from '../../state/ui-store';
import { applyLineType } from '../fields/line-type';
import { oneStep } from '../fields/one-step';
import { editableEdges } from '../lock';

/** Plural-aware suffix for announcements: "" for one connector, " for 3 connectors" otherwise. */
const forCount = (n: number): string => (n === 1 ? '' : ` for ${String(n)} connectors`);

export function applyLineStyle(
  editor: DeckEditor,
  ids: readonly Id[],
  patch: Exclude<EdgeStylePatch, { shape: EdgeShape }>,
  said: string,
): void {
  // A locked connector refuses a restyle, so it is left out and counted.
  const editable = editableEdges(editor, ids);
  if (editable === null) return;
  oneStep(editor, () => {
    editor.setEdgeStyle(editable.ids, patch);
  });
  useUiStore.getState().announce(`${said}${forCount(editable.ids.length)}${editable.note}`);
}

export { applyLineType };

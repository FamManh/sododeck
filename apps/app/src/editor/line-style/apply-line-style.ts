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

/** Plural-aware suffix for announcements: "" for one connector, " for 3 connectors" otherwise. */
const forCount = (n: number): string => (n === 1 ? '' : ` for ${String(n)} connectors`);

export function applyLineStyle(
  editor: DeckEditor,
  ids: readonly Id[],
  patch: Exclude<EdgeStylePatch, { shape: EdgeShape }>,
  said: string,
): void {
  if (ids.length === 0) return;
  oneStep(editor, () => {
    editor.setEdgeStyle(ids, patch);
  });
  useUiStore.getState().announce(`${said}${forCount(ids.length)}`);
}

export { applyLineType };

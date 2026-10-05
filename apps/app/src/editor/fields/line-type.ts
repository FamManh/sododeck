/**
 * The connector line types shared by the action list, the drawer and the multi-connection panel
 * (029). One write path: one undo step, remembered for new connectors, announced.
 */
import { edgeShape, type DeckEditor } from '@sododeck/model';
import type { Edge, EdgeShape, Id } from '@sododeck/schema';
import { CornerDownRight, Minus, Spline, type LucideIcon } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import { editableEdges } from '../lock';
import { oneStep } from './one-step';

export const LINE_TYPES: readonly { value: EdgeShape; label: string; icon: LucideIcon }[] = [
  { value: 'curved', label: 'Curved', icon: Spline },
  { value: 'elbow', label: 'Elbow', icon: CornerDownRight },
  { value: 'straight', label: 'Straight', icon: Minus },
];

export const lineTypeLabel = (shape: EdgeShape): string =>
  LINE_TYPES.find((type) => type.value === shape)?.label ?? shape;

/** The shape every edge shares, or `null` when they differ or there are none. */
export function sharedLineShape(edges: readonly Pick<Edge, 'route' | 'style'>[]): EdgeShape | null {
  const shapes = new Set(edges.map(edgeShape));
  const [only] = shapes;
  return shapes.size === 1 && only !== undefined ? only : null;
}

/** Sets the line type of `ids` as one undo step, remembers it for new connectors, announces it. */
export function applyLineType(editor: DeckEditor, ids: readonly Id[], shape: EdgeShape): void {
  // A locked connector refuses a reshape, so it is left out and counted.
  const editable = editableEdges(editor, ids);
  if (editable === null) return;
  oneStep(editor, () => {
    editor.setEdgeShape(editable.ids, shape);
  });
  const ui = useUiStore.getState();
  ui.setLastLineShape(shape);
  ui.announce(
    `${
      editable.ids.length === 1
        ? `Line type: ${lineTypeLabel(shape)}`
        : `Line type: ${lineTypeLabel(shape)} for ${String(editable.ids.length)} connectors`
    }${editable.note}`,
  );
}

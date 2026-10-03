/**
 * The Frame tool's writes (031 research R5, Frame = Group). A drawn rectangle becomes a group
 * through the existing `groupSelection` (one undo step, with whatever is fully inside), then the
 * group's label opens for a name, as ⌘G's does; the tool returns to Select.
 */
import type { DeckEditor } from '@sododeck/model';
import type { Id } from '@sododeck/schema';

import { isFlowMode, useUiStore } from '../../state/ui-store';
import type { Point, Rect } from '../canvas-geometry';
import { NEW_GROUP_TITLE } from '../editing/group-from-selection';
import { scopeOf, visibleGraph } from '../visible-graph';
import { readViewState } from '../views/use-current-view';
import { clickFrame, framePlan } from './frame-draw';

/** Frames are document edits: none in flow mode or while a flow is recorded. */
function canDraw(): boolean {
  const ui = useUiStore.getState();
  return !isFlowMode(ui) && ui.flowSession === null;
}

/** Arms the tool from the Frame tile: the next drag (or click) on the canvas draws a frame. */
export function armFrameTool(): void {
  if (!canDraw()) return;
  const ui = useUiStore.getState();
  ui.setTool('frame');
  ui.announce('Frame: drag on the canvas to draw a group frame, Esc to cancel');
}

/** Creates the group `drawn` describes (clamped to the minimum frame). Returns its id. */
export function createFrame(editor: DeckEditor, drawn: Rect): Id | null {
  const ui = useUiStore.getState();
  ui.setTool('select');
  if (!canDraw()) return null;
  const view = readViewState(editor.doc);
  const graph = visibleGraph(view.deck, scopeOf(ui.drill), view.collapsed);
  const plan = framePlan(view.deck, graph, drawn);
  const id = editor.groupSelection({
    nodes: plan.nodes,
    groups: plan.groups,
    title: NEW_GROUP_TITLE,
    ...(plan.parent === undefined ? {} : { parent: plan.parent }),
    frame: plan.frame,
    // A view with its own layout draws the frame where it was drawn, too (016 R4).
    ...(view.isBase ? {} : { viewFrames: { [view.view.id]: plan.frame } }),
  });
  ui.select({ groups: [id] });
  ui.startTitleEdit({ target: 'group', id, isNew: true });
  const count = plan.nodes.length + plan.groups.length;
  ui.announce(`Frame added, ${String(count)} ${count === 1 ? 'item' : 'items'}`);
  return id;
}

/** ⏎ on the Frame tile: a default-size frame centred on `point` (the view centre). */
export function placeFrameAtCentre(editor: DeckEditor, point: Point): Id | null {
  return createFrame(editor, clickFrame(point));
}

/**
 * Ordering of flows and steps (006 research R13, FR-001a, FR-020). The `flows` array order is the
 * order within each feature; the `steps` array order is the order within each path. These turn a
 * position inside a group into the array index the editor's `reorder` / `moveStep` take. Pure,
 * except `moveToFeature`, which writes through the editor.
 */
import type { DeckEditor } from '@sododeck/model';
import type { Flow, SododeckFile } from '@sododeck/schema';

/** The feature a flow is listed under; `null` for "No feature" (also a dangling feature id). */
export function featureOf(deck: SododeckFile, flow: Flow): string | null {
  const id = flow.feature;
  return id !== undefined && deck.features.some((f) => f.id === id) ? id : null;
}

/** Flows listed under a feature (`null`: "No feature"), in order. */
export function flowsIn(deck: SododeckFile, featureId: string | null): Flow[] {
  return deck.flows.filter((f) => featureOf(deck, f) === featureId);
}

/**
 * Index in `flows` that puts `flowId` at `position` among the flows of `featureId`
 * (position clamped to the group).
 */
export function indexForMoveWithinFeature(
  deck: SododeckFile,
  flowId: string,
  featureId: string | null,
  position: number,
): number {
  const rest = deck.flows.filter((f) => f.id !== flowId);
  const group = rest.filter((f) => featureOf(deck, f) === featureId);
  const neighbour = group[Math.max(0, position)];
  if (neighbour !== undefined) return rest.indexOf(neighbour);
  const last = group.at(-1);
  return last === undefined ? rest.length : rest.indexOf(last) + 1;
}

/** Moves a flow into another feature, last in its list (FR-001a). One undo step. */
export function moveToFeature(editor: DeckEditor, flowId: string, featureId: string | null): void {
  editor.batch(() => {
    editor.update('flows', flowId, { feature: featureId });
    editor.reorder('flows', flowId, Number.MAX_SAFE_INTEGER);
  });
}

/** Index in `flow.steps` that puts `stepId` at `position` within its own path. */
export function stepIndexForMoveWithinPath(flow: Flow, stepId: string, position: number): number {
  const moved = flow.steps.find((s) => s.id === stepId);
  const rest = flow.steps.filter((s) => s.id !== stepId);
  const path = rest.filter((s) => s.branch === moved?.branch);
  const neighbour = path[Math.max(0, position)];
  if (neighbour !== undefined) return rest.indexOf(neighbour);
  const last = path.at(-1);
  return last === undefined ? rest.length : rest.indexOf(last) + 1;
}

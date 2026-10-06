/**
 * Every kind of object the canvas can select, in one place. Delete, the inspector's trash, Cut,
 * the marquee count and Select all read this list instead of naming kinds one by one, so a kind
 * added to `Selection` reaches all of them (a group was once left out of Delete this way).
 */
import { isSchemaGroupId, type RemovalTarget } from '@sododeck/model';
import type { Id } from '@sododeck/schema';

/** The canvas selection: deck ids per kind (never drawn `group:` / `sticky:` ids). */
export interface Selection {
  readonly nodes: readonly Id[];
  readonly edges: readonly Id[];
  readonly groups: readonly Id[];
  readonly stickies: readonly Id[];
  readonly images: readonly Id[];
}

export type SelectionKind = keyof Selection;

/**
 * Each kind with its delete order: components first, then connections, notes and images, and
 * groups last (deleting a group ungroups it, so its selected members are gone by then). A
 * `Record` so a kind missing here is a type error.
 */
const KIND_ORDER: Readonly<Record<SelectionKind, number>> = {
  nodes: 0,
  edges: 1,
  stickies: 2,
  images: 3,
  groups: 4,
};

/** Every selectable kind, in delete order. */
export const SELECTION_KINDS: readonly SelectionKind[] = (
  Object.keys(KIND_ORDER) as SelectionKind[]
).sort((a, b) => KIND_ORDER[a] - KIND_ORDER[b]);

/** How many objects `selection` holds, over every kind. */
export function selectionSize(selection: Partial<Selection>): number {
  return SELECTION_KINDS.reduce((sum, kind) => sum + (selection[kind]?.length ?? 0), 0);
}

export function isSelectionEmpty(selection: Partial<Selection>): boolean {
  return selectionSize(selection) === 0;
}

/**
 * What deleting `selection` removes, every kind, in delete order. A group target ungroups (the
 * model's `remove('groups')` keeps its members); a derived schema frame (048) stores nothing and
 * is skipped. Locks are filtered later, by `withoutLocked`.
 */
export function selectionTargets(selection: Partial<Selection>): RemovalTarget[] {
  return SELECTION_KINDS.flatMap((kind) =>
    (selection[kind] ?? [])
      .filter((id) => kind !== 'groups' || !isSchemaGroupId(id))
      .map((id): RemovalTarget => ({ scope: kind, id })),
  );
}

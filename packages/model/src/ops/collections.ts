/** Add, update and reorder objects of the top-level collections (data-model "Edit input and patch"). */
import type { Id } from '@sododeck/schema';

import { fromY, isRecord, toY } from '../convert';
import { collectionArray, rulesMap, type Collection, type DeckDoc, type ObjectOf } from '../layout';
import { findIndexById, type EditContext } from './context';
import { DeckEditError } from '../errors';
import { anchorableIds, deckHasId, type IdPrefix } from '../ids';
import { assertRefsExist, assertValid, validateObject } from '../validate';
import { applyPatch, writePatch } from './patch';
import { allRefsOf, refsOf, stepBranchIssues, stepRefs } from './refs';
import type { NewObject, Patch } from './types';

export const PREFIXES = {
  nodes: 'node',
  groups: 'group',
  edges: 'edge',
  views: 'view',
  features: 'feature',
  flows: 'flow',
  stickies: 'sticky',
} as const satisfies Record<Collection, IdPrefix>;

/** What a thrown error names the object as, e.g. `Node "x" does not exist.` */
export const LABELS = {
  nodes: 'Node',
  groups: 'Group',
  edges: 'Edge',
  views: 'View',
  features: 'Feature',
  flows: 'Flow',
  stickies: 'Sticky',
} as const satisfies Record<Collection, string>;

/** Input column ids of a rule, for checking step sample inputs. */
export function inputColumnsOf(doc: DeckDoc): (ruleId: Id) => ReadonlySet<Id> | undefined {
  return (ruleId) => {
    const rule = rulesMap(doc).get(ruleId);
    if (rule === undefined) return undefined;
    const inputs = fromY(rule.get('inputs'));
    return new Set(
      Array.isArray(inputs)
        ? inputs.flatMap((c) => (isRecord(c) && typeof c.id === 'string' ? [c.id] : []))
        : [],
    );
  };
}

/** Refuses an explicit id that exists anywhere in the deck or earlier in the same insert. */
export function assertFreeIds(doc: DeckDoc, ids: readonly { path: string; id: Id }[]): void {
  const seen = new Set<Id>();
  const issues = ids
    .filter(({ id }) => {
      const taken = seen.has(id) || deckHasId(doc, id);
      seen.add(id);
      return taken;
    })
    .map(({ path, id }) => ({ path, message: `Id "${id}" is already used in this deck.` }));
  if (issues.length > 0) throw new DeckEditError('duplicate-id', issues);
}

export function addObject<C extends Collection>(ctx: EditContext, c: C, data: NewObject<C>): Id {
  const { doc } = ctx;
  const { id: explicitId, ...fields } = data as Record<string, unknown> & { id?: Id };
  const id = explicitId ?? ctx.allocate(PREFIXES[c]);
  const object: Record<string, unknown> = { id, ...fields };
  if (c === 'flows' && object.steps === undefined) object.steps = [];

  assertValid(validateObject(c, object));
  const steps = c === 'flows' && Array.isArray(object.steps) ? object.steps.filter(isRecord) : [];
  const branches =
    c === 'flows' && Array.isArray(object.branches) ? object.branches.filter(isRecord) : [];
  const explicitIds = [
    ...(explicitId === undefined ? [] : [{ path: 'id', id }]),
    ...steps.map((step, i) => ({ path: `steps.${String(i)}.id`, id: step.id as Id })),
    ...branches.map((b, i) => ({ path: `branches.${String(i)}.id`, id: b.id as Id })),
  ];
  const branchIds = new Set(branches.map((b) => b.id as Id));
  assertFreeIds(doc, explicitIds);
  const refs = allRefsOf(c, object);
  const inputColumns = inputColumnsOf(doc);
  for (const [i, step] of steps.entries()) {
    const checked = stepRefs(step, `steps.${String(i)}.`, inputColumns);
    checked.issues.push(...stepBranchIssues(step, `steps.${String(i)}.`, branchIds));
    if (checked.issues.length > 0) throw new DeckEditError('missing-reference', checked.issues);
    refs.push(...checked.refs);
  }
  assertRefsExist(doc, refs, () => anchorableIds(doc));

  ctx.transact(() => {
    collectionArray(doc, c).push([toY(object) as never]);
  });
  ctx.reserve(explicitIds.map((e) => e.id));
  return id;
}

export function updateObject<C extends Collection>(
  ctx: EditContext,
  c: C,
  id: Id,
  patch: Patch<ObjectOf<C>>,
): void {
  const { doc } = ctx;
  const array = collectionArray(doc, c);
  const map = array.get(findIndexById(array, id, LABELS[c]));
  const { candidate, changed } = applyPatch(fromY(map) as Record<string, unknown>, patch, [
    'steps',
    'branches',
  ]);
  if (changed.length === 0) return;

  assertValid(validateObject(c, candidate));
  // Only the changed fields are checked, so an object with a broken reference stays editable.
  assertRefsExist(
    doc,
    changed.flatMap((key) => refsOf(c, key, candidate[key])),
    () => anchorableIds(doc),
  );

  ctx.transact(() => {
    writePatch(map, candidate, changed);
  }, `${c}:${id}`);
}

/** Moves an item of a Y.Array to `toIndex` (clamped), by re-inserting a copy. */
export function moveInArray(
  ctx: EditContext,
  array: Parameters<typeof findIndexById>[0],
  from: number,
  toIndex: number,
): void {
  const to = Math.max(0, Math.min(array.length - 1, Math.trunc(toIndex)));
  if (to === from) return;
  // Yjs has no move: delete + insert in one transaction. A concurrent edit of the moved object
  // in another tab is lost (known Y.Array limitation, spec Assumptions).
  const copy = fromY(array.get(from));
  ctx.transact(() => {
    array.delete(from, 1);
    array.insert(to, [toY(copy) as never]);
  });
}

export function reorderObject(ctx: EditContext, c: Collection, id: Id, toIndex: number): void {
  const array = collectionArray(ctx.doc, c);
  moveInArray(ctx, array, findIndexById(array, id, LABELS[c]), toIndex);
}

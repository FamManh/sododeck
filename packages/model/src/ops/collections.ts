/** Add, update and reorder objects of the top-level collections (data-model "Edit input and patch"). */
import type { Id } from '@sododeck/schema';

import {
  collectionMap,
  insertAt,
  planMove,
  rulesMap,
  type Collection,
  type DeckDoc,
  type ObjectOf,
} from '../layout';
import { isRecord } from '../convert';
import { columnIds, readObject } from '../read';
import { createObject, writeFields } from '../write';
import { requireEntry, type EditContext } from './context';
import { DeckEditError } from '../errors';
import { anchorableIds, deckHasId, type IdPrefix } from '../ids';
import { assertRefsExist, assertValid, validateObject } from '../validate';
import { assertNewTableParts, columnEndIssues, tablePatch } from './db-tables';
import { applyPatch } from './patch';
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
    return rule === undefined ? undefined : new Set(columnIds(rule, 'inputs'));
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

/** Relationship ends (040) must name columns of their end table when it is a table. */
function assertColumnEnds(
  doc: DeckDoc,
  edge: Record<string, unknown>,
  keys: readonly string[],
): void {
  const issues = columnEndIssues(doc, edge, keys);
  if (issues.length > 0) throw new DeckEditError('missing-reference', issues);
}

export function addObject<C extends Collection>(
  ctx: EditContext,
  c: C,
  data: NewObject<C>,
  key?: string,
): Id {
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
  if (c === 'nodes') assertNewTableParts(ctx, object);
  const refs = allRefsOf(c, object);
  const inputColumns = inputColumnsOf(doc);
  for (const [i, step] of steps.entries()) {
    const checked = stepRefs(step, `steps.${String(i)}.`, inputColumns);
    checked.issues.push(...stepBranchIssues(step, `steps.${String(i)}.`, branchIds));
    if (checked.issues.length > 0) throw new DeckEditError('missing-reference', checked.issues);
    refs.push(...checked.refs);
  }
  assertRefsExist(doc, refs, () => anchorableIds(doc));
  if (c === 'edges') assertColumnEnds(doc, object, Object.keys(object));

  ctx.transact(() => {
    insertAt(collectionMap(doc, c), id, createObject(c, object, ''));
  }, key);
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
  const map = requireEntry(collectionMap(doc, c), id, LABELS[c]);
  const { candidate, changed } = applyPatch(
    readObject(c, id, map),
    c === 'nodes' ? tablePatch(patch) : patch,
    ['steps', 'branches'],
  );
  if (changed.length === 0) return;

  assertValid(validateObject(c, candidate));
  // Only the changed fields are checked, so an object with a broken reference stays editable.
  assertRefsExist(
    doc,
    changed.flatMap((key) => refsOf(c, key, candidate[key])),
    () => anchorableIds(doc),
  );
  if (c === 'edges') assertColumnEnds(doc, candidate, changed);

  ctx.transact(() => {
    writeFields(map, c, candidate, changed);
  }, `${c}:${id}`);
}

/** Moves an object to `toIndex` in its collection (clamped): one order key change (R3). */
export function reorderObject(ctx: EditContext, c: Collection, id: Id, toIndex: number): void {
  const list = collectionMap(ctx.doc, c);
  requireEntry(list, id, LABELS[c]);
  const move = planMove(list, id, toIndex);
  if (move !== undefined) ctx.transact(move);
}

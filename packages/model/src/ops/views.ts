/**
 * View ops (011, research R4–R5, ADR 0012). The only writers of view internals: the app never
 * patches `positions`, `pinned`, `collapsed` or filters with the generic `update('views', …)`.
 *
 * A deck without stored views shows `VIEW_PRESETS`. The first op that writes a view first stores
 * the presets in their own transaction with the untracked origin, so undo never removes them;
 * then the change itself is applied with the tracked origin (collapse excepted: never tracked).
 */
import type { Id, View, ViewType } from '@sododeck/schema';
import * as Y from 'yjs';

import { jsonEqual, toY, type YObject } from '../convert';
import { DeckEditError } from '../errors';
import type { Point } from '../geometry';
import { collectionMap, insertAt, noteOrder, orderedEntries, type ListMap } from '../layout';
import { keysBetween } from '../order-key';
import { readObject } from '../read';
import { createObject } from '../write';
import { assertRefsExist, assertValid, validateObject, type Ref } from '../validate';
import { anchorableIds } from '../ids';
import { isSchemaGroupId } from '../schema-groups';
import { CUSTOM_VIEW_DEFAULTS, nextCustomTitle, VIEW_PRESETS } from '../views';
import { removeObject, type RemovalResult } from './cascade';
import type { EditContext } from './context';

/** Settings `updateView` may change. A key set to `undefined` or `[]` removes the field. */
export type ViewSettingsPatch = {
  [
    K in
      | 'title'
      | 'subtitleField'
      | 'feature'
      | 'excludeGroups'
      | 'excludeKinds'
      | 'excludeTags'
      | 'dimKinds'
      | 'schemas'
      | 'detail'
  ]?: View[K] | undefined;
};

const SETTINGS_KEYS = [
  'title',
  'subtitleField',
  'feature',
  'excludeGroups',
  'excludeKinds',
  'excludeTags',
  'dimKinds',
  'schemas',
  'detail',
] as const satisfies readonly (keyof ViewSettingsPatch)[];

/** The views the deck shows now (stored, else presets), as plain data. */
function currentViews(ctx: EditContext): { views: readonly View[]; stored: boolean } {
  const list = collectionMap(ctx.doc, 'views');
  if (list.size === 0) return { views: VIEW_PRESETS, stored: false };
  const views = orderedEntries(list).map(
    ([id, m]) => readObject('views', id, m) as unknown as View,
  );
  return { views, stored: true };
}

export function resolveView(ctx: EditContext, viewId: Id): { view: View; index: number } {
  const { views } = currentViews(ctx);
  const index = views.findIndex((v) => v.id === viewId);
  const view = views[index];
  if (view === undefined) {
    throw new DeckEditError('not-found', [
      { path: '', message: `View "${viewId}" does not exist.` },
    ]);
  }
  return { view, index };
}

/**
 * Stores the presets when the deck has none (untracked: never an undo step, FR-001). Fixed ids and
 * fixed order keys, so two tabs doing it at once converge on three views, not six (R2).
 */
function materialize(ctx: EditContext): void {
  const list = collectionMap(ctx.doc, 'views');
  if (list.size > 0) return;
  const keys = keysBetween(null, null, VIEW_PRESETS.length);
  ctx.transactUntracked(() => {
    VIEW_PRESETS.forEach((view, i) => {
      const key = keys[i] ?? '';
      list.set(view.id, createObject('views', { ...view }, key));
      noteOrder(list, key);
    });
  });
}

/** The view's Y.Map, storing the presets first if needed. Call only after validating. */
export function viewMap(ctx: EditContext, viewId: Id): YObject {
  materialize(ctx);
  const map = collectionMap(ctx.doc, 'views').get(viewId);
  if (map === undefined) {
    throw new DeckEditError('not-found', [
      { path: '', message: `View "${viewId}" does not exist.` },
    ]);
  }
  return map;
}

function nodeMaps(ctx: EditContext): ListMap {
  return collectionMap(ctx.doc, 'nodes');
}

/** Sets `map[field]` to `{x,y}`, keeping an existing nested map so concurrent axes merge. */
function writePoint(map: Y.Map<unknown>, field: string, point: Point): void {
  const existing = map.get(field);
  if (existing instanceof Y.Map) {
    if (existing.get('x') !== point.x) existing.set('x', point.x);
    if (existing.get('y') !== point.y) existing.set('y', point.y);
  } else {
    map.set(field, toY(point));
  }
}

/** Adds (`on`) or removes ids of a Y.Array list field; drops the field when it gets empty. */
function toggleInList(map: YObject, field: string, ids: readonly Id[], on: boolean): void {
  let list = map.get(field);
  if (on) {
    if (!(list instanceof Y.Array)) {
      list = new Y.Array();
      map.set(field, list);
    }
    const present = new Set(list.toArray());
    const missing = ids.filter((id, i) => !present.has(id) && ids.indexOf(id) === i);
    if (missing.length > 0) list.push(missing);
    return;
  }
  if (!(list instanceof Y.Array)) return;
  const drop = new Set(ids);
  for (let i = list.length - 1; i >= 0; i--) if (drop.has(list.get(i) as Id)) list.delete(i, 1);
  if (list.length === 0) map.delete(field);
}

function listOf(view: View, field: 'pinned' | 'collapsed'): readonly Id[] {
  return view[field] ?? [];
}

/**
 * Moves nodes in a view (FR-020, FR-021). In the base view (the first) it writes `node.position`
 * and drops that view's own entry; in any other view it writes `view.positions`. Ids of nodes
 * that no longer exist are skipped (a layout may finish after a delete).
 */
export function moveInView(
  ctx: EditContext,
  viewId: Id,
  positions: Readonly<Record<Id, Point>>,
): void {
  const { view, index } = resolveView(ctx, viewId);
  const nodes = nodeMaps(ctx);
  const entries = Object.entries(positions).filter(([id]) => nodes.has(id));
  const bad = entries.filter(([, p]) => !Number.isFinite(p.x) || !Number.isFinite(p.y));
  if (bad.length > 0) {
    throw new DeckEditError(
      'invalid',
      bad.map(([id]) => ({
        path: `positions.${id}`,
        message: 'Coordinates must be finite numbers.',
      })),
    );
  }
  if (entries.length === 0) return;

  const key = `views:${viewId}:positions`;
  if (index === 0) {
    const own = view.positions ?? {};
    const dropOwn = entries.some(([id]) => Object.hasOwn(own, id));
    ctx.transact(() => {
      for (const [id, point] of entries) {
        const node = nodes.get(id);
        if (node !== undefined) writePoint(node as Y.Map<unknown>, 'position', point);
      }
      const map = collectionMap(ctx.doc, 'views').get(view.id);
      if (!dropOwn || map === undefined) return;
      const stored = map.get('positions');
      if (!(stored instanceof Y.Map)) return;
      for (const [id] of entries) stored.delete(id);
      if (stored.size === 0) map.delete('positions');
    }, key);
    return;
  }

  const map = viewMap(ctx, viewId);
  ctx.transact(() => {
    let stored = map.get('positions');
    if (!(stored instanceof Y.Map)) {
      stored = new Y.Map();
      map.set('positions', stored);
    }
    for (const [id, point] of entries) writePoint(stored as Y.Map<unknown>, id, point);
  }, key);
}

/** Pins or unpins nodes in one view (FR-022, FR-023). One undo step. */
export function setPinned(
  ctx: EditContext,
  viewId: Id,
  nodeIds: readonly Id[],
  pinned: boolean,
): void {
  const { view } = resolveView(ctx, viewId);
  const nodes = nodeMaps(ctx);
  const missing = nodeIds.filter((id) => !nodes.has(id));
  if (missing.length > 0) {
    throw new DeckEditError(
      'missing-reference',
      missing.map((id) => ({ path: 'pinned', message: `"${id}" does not exist (nodes).` })),
    );
  }
  const current = new Set(listOf(view, 'pinned'));
  if (nodeIds.every((id) => current.has(id) === pinned)) return;
  const map = viewMap(ctx, viewId);
  ctx.transact(() => {
    toggleInList(map, 'pinned', nodeIds, pinned);
  });
}

/**
 * Collapses or expands a group in one view (FR-050). Saved and synced but never an undo step:
 * it runs with the untracked origin, as does the preset materialization before it.
 */
export function setCollapsed(ctx: EditContext, viewId: Id, groupId: Id, collapsed: boolean): void {
  const { view } = resolveView(ctx, viewId);
  // A derived schema group (048) has no stored object to check.
  if (collapsed && !isSchemaGroupId(groupId)) {
    assertRefsExist(ctx.doc, [{ path: 'collapsed', id: groupId, target: 'groups' }], () =>
      anchorableIds(ctx.doc),
    );
  }
  if (listOf(view, 'collapsed').includes(groupId) === collapsed) return;
  const map = viewMap(ctx, viewId);
  ctx.transactUntracked(() => {
    toggleInList(map, 'collapsed', [groupId], collapsed);
  });
}

/** Changes a view's title and settings (FR-041, FR-043). A title typing burst is one step. */
export function updateView(ctx: EditContext, viewId: Id, patch: ViewSettingsPatch): void {
  const { view } = resolveView(ctx, viewId);
  const fields = new Map<string, unknown>(Object.entries(view));
  const changed: string[] = [];
  for (const key of SETTINGS_KEYS) {
    if (!Object.hasOwn(patch, key)) continue;
    const value: unknown = patch[key];
    const remove = value === undefined || (Array.isArray(value) && value.length === 0);
    const next = remove ? undefined : value;
    if (jsonEqual(next, fields.get(key))) continue;
    if (next === undefined) {
      if (key === 'title') {
        throw new DeckEditError('invalid', [{ path: 'title', message: 'A view needs a name.' }]);
      }
      fields.delete(key);
    } else {
      fields.set(key, next);
    }
    changed.push(key);
  }
  if (changed.length === 0) return;
  const candidate: Record<string, unknown> = Object.fromEntries(fields);
  if (typeof candidate.title !== 'string' || candidate.title.trim() === '') {
    throw new DeckEditError('invalid', [{ path: 'title', message: 'A view needs a name.' }]);
  }
  assertValid(validateObject('views', candidate));
  const refs: Ref[] = [];
  if (changed.includes('feature') && typeof candidate.feature === 'string') {
    refs.push({ path: 'feature', id: candidate.feature, target: 'features' });
  }
  if (changed.includes('excludeGroups')) {
    for (const [i, id] of (candidate.excludeGroups as Id[] | undefined)?.entries() ?? []) {
      refs.push({ path: `excludeGroups.${String(i)}`, id, target: 'groups' });
    }
  }
  assertRefsExist(ctx.doc, refs, () => anchorableIds(ctx.doc));

  const map = viewMap(ctx, viewId);
  ctx.transact(() => {
    for (const key of changed) {
      const value = candidate[key];
      if (value === undefined) map.delete(key);
      else map.set(key, toY(value));
    }
  }, `views:${viewId}`);
}

/** Appends a view, "Custom <n>" by default (FR-040). Returns its id. One undo step. */
export function addView(ctx: EditContext, data: { title?: string; type?: ViewType } = {}): Id {
  const { views } = currentViews(ctx);
  const title = data.title ?? nextCustomTitle(views);
  if (title.trim() === '') {
    throw new DeckEditError('invalid', [{ path: 'title', message: 'A view needs a name.' }]);
  }
  const id = ctx.allocate('view');
  const view: View = {
    id,
    type: data.type ?? CUSTOM_VIEW_DEFAULTS.type,
    title,
    subtitleField: CUSTOM_VIEW_DEFAULTS.subtitleField,
  };
  assertValid(validateObject('views', view));
  materialize(ctx);
  ctx.transact(() => {
    insertAt(collectionMap(ctx.doc, 'views'), id, createObject('views', { ...view }, ''));
  });
  return id;
}

/** Deletes a view (FR-042); the last one cannot go. Undo restores every field. */
export function removeView(ctx: EditContext, viewId: Id): RemovalResult {
  const { views } = currentViews(ctx);
  resolveView(ctx, viewId);
  if (views.length <= 1) {
    throw new DeckEditError('invalid', [{ path: '', message: 'A deck needs at least one view.' }]);
  }
  materialize(ctx);
  return removeObject(ctx, 'views', viewId);
}

/**
 * Group frame ops (016, research R2 and R4, ADR 0017). A frame is `group.position` + `group.size`
 * on the base view (the first) and `view.groupFrames[id]` in any other view, mirroring how
 * `moveInView` writes node positions.
 */
import type { Frame, Id } from '@sododeck/schema';
import * as Y from 'yjs';

import { toY, type YObject } from '../convert';
import { DeckEditError } from '../errors';
import { collectionMap, orderedEntries, type ListMap } from '../layout';
import type { EditContext } from './context';
import { resolveView, viewMap } from './views';

function groupMaps(ctx: EditContext): ListMap {
  return collectionMap(ctx.doc, 'groups');
}

function assertFrames(entries: readonly (readonly [Id, Frame])[]): void {
  const issues = entries.flatMap(([id, { position, size }]) => {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      return [
        { path: `groupFrames.${id}.position`, message: 'Coordinates must be finite numbers.' },
      ];
    }
    if (!(size.width > 0 && size.height > 0 && Number.isFinite(size.width + size.height))) {
      return [{ path: `groupFrames.${id}.size`, message: 'Width and height must be above 0.' }];
    }
    return [];
  });
  if (issues.length > 0) throw new DeckEditError('invalid', issues);
}

/** Sets `map[field]` to a nested map of `value`, keeping an existing one so concurrent keys merge. */
function writeFields(map: Y.Map<unknown>, field: string, value: Record<string, number>): void {
  const existing = map.get(field);
  if (!(existing instanceof Y.Map)) {
    map.set(field, toY(value));
    return;
  }
  for (const [key, v] of Object.entries(value)) if (existing.get(key) !== v) existing.set(key, v);
}

function writeGroupFrame(group: Y.Map<unknown>, { position, size }: Frame): void {
  writeFields(group, 'position', { x: position.x, y: position.y });
  writeFields(group, 'size', { width: size.width, height: size.height });
}

function writeViewFrame(frames: Y.Map<unknown>, id: Id, frame: Frame): void {
  let entry = frames.get(id);
  if (!(entry instanceof Y.Map)) {
    entry = new Y.Map();
    frames.set(id, entry);
  }
  writeGroupFrame(entry as Y.Map<unknown>, frame);
}

function frameOfMap(group: YObject): Frame | undefined {
  const position = group.get('position');
  const size = group.get('size');
  if (!(position instanceof Y.Map) || !(size instanceof Y.Map)) return undefined;
  return {
    position: { x: position.get('x') as number, y: position.get('y') as number },
    size: { width: size.get('width') as number, height: size.get('height') as number },
  };
}

function viewFramesMap(view: YObject): Y.Map<unknown> {
  let frames = view.get('groupFrames');
  if (!(frames instanceof Y.Map)) {
    frames = new Y.Map();
    view.set('groupFrames', frames);
  }
  return frames as Y.Map<unknown>;
}

/**
 * Writes the frames of groups that have none, untracked (never an undo step): the base frames on
 * the groups, and per stored view its own frames. Frames that exist by write time are kept, so
 * two tabs fitting at once agree. Unknown groups and views are skipped.
 */
export function fillGroupFrames(
  ctx: EditContext,
  base: ReadonlyMap<Id, Frame>,
  perView: ReadonlyMap<Id, ReadonlyMap<Id, Frame>> = new Map(),
): void {
  assertFrames([...base, ...[...perView.values()].flatMap((frames) => [...frames])]);
  const groups = groupMaps(ctx);
  const views = orderedEntries(collectionMap(ctx.doc, 'views')).filter(([id]) => perView.has(id));
  const baseWrites = [...base].filter(([id]) => {
    const group = groups.get(id);
    return group !== undefined && frameOfMap(group) === undefined;
  });
  const viewWrites = views.flatMap(([viewId, view]) => {
    const frames = perView.get(viewId) ?? new Map<Id, Frame>();
    const own = view.get('groupFrames');
    const missing = [...frames].filter(
      ([id]) => groups.has(id) && !(own instanceof Y.Map && own.has(id)),
    );
    return missing.length === 0 ? [] : [{ view, missing }];
  });
  if (baseWrites.length === 0 && viewWrites.length === 0) return;
  ctx.transactUntracked(() => {
    for (const [id, frame] of baseWrites) {
      const group = groups.get(id);
      if (group !== undefined) writeGroupFrame(group as Y.Map<unknown>, frame);
    }
    for (const { view, missing } of viewWrites) {
      const frames = viewFramesMap(view);
      for (const [id, frame] of missing) writeViewFrame(frames, id, frame);
    }
  });
}

/**
 * Copies every base frame into a view that has no frames of its own yet, untracked: from its
 * first frame edit on, the view keeps its own frames, as it keeps its own positions (R4).
 */
export function materializeFrames(ctx: EditContext, view: YObject): void {
  if (view.get('groupFrames') instanceof Y.Map) return;
  const copies = [...groupMaps(ctx)].flatMap(([id, group]) => {
    const frame = frameOfMap(group);
    return frame === undefined ? [] : [[id, frame] as const];
  });
  ctx.transactUntracked(() => {
    const frames = viewFramesMap(view);
    for (const [id, frame] of copies) writeViewFrame(frames, id, frame);
  });
}

/**
 * Sets group frames in a view (R4). The base view writes `group.position` / `group.size` and drops
 * that view's own entries; any other view writes `view.groupFrames` (after storing the presets and
 * copying the base frames, both untracked). Unknown groups are skipped. Merges inside a gesture.
 */
export function setGroupFrames(
  ctx: EditContext,
  viewId: Id,
  frames: Readonly<Record<Id, Frame>>,
): void {
  const { view, index } = resolveView(ctx, viewId);
  const groups = groupMaps(ctx);
  const entries = Object.entries(frames).filter(([id]) => groups.has(id));
  assertFrames(entries);
  if (entries.length === 0) return;

  const key = `views:${viewId}:groupFrames`;
  if (index === 0) {
    const own = view.groupFrames ?? {};
    const dropOwn = entries.some(([id]) => Object.hasOwn(own, id));
    ctx.transact(() => {
      for (const [id, frame] of entries) {
        const group = groups.get(id);
        if (group !== undefined) writeGroupFrame(group as Y.Map<unknown>, frame);
      }
      const map = collectionMap(ctx.doc, 'views').get(view.id);
      if (!dropOwn || map === undefined) return;
      const stored = map.get('groupFrames');
      if (!(stored instanceof Y.Map)) return;
      for (const [id] of entries) stored.delete(id);
      if (stored.size === 0) map.delete('groupFrames');
    }, key);
    return;
  }

  const map = viewMap(ctx, viewId);
  materializeFrames(ctx, map);
  ctx.transact(() => {
    const stored = viewFramesMap(map);
    for (const [id, frame] of entries) writeViewFrame(stored, id, frame);
  }, key);
}

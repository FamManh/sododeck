/**
 * Group the selection (016 research R11): a new group with a fitted frame, its members repointed,
 * in one transaction (one undo step). The app computes the parent (the innermost common group)
 * and the frames; the model checks and writes.
 */
import type { Frame, Id } from '@sododeck/schema';
import * as Y from 'yjs';

import { toY } from '../convert';
import { DeckEditError } from '../errors';
import { anchorableIds } from '../ids';
import { collectionMap, insertAt } from '../layout';
import { createObject } from '../write';
import { assertRefsExist, assertValid, validateObject, type Ref } from '../validate';
import type { EditContext } from './context';
import { materializeFrames } from './frames';
import { resolveView, viewMap } from './views';

export interface GroupSelection {
  nodes: readonly Id[];
  groups: readonly Id[];
  title: string;
  /** The group the new one goes into; the top level when absent. */
  parent?: Id;
  /** The frame on the base canvas. */
  frame: Frame;
  /** The frame in other views that draw their own positions, by view id. */
  viewFrames?: Readonly<Record<Id, Frame>>;
}

/** `id` and every group it encloses (cycle-safe). */
function subtreeOf(ctx: EditContext, ids: readonly Id[]): Set<Id> {
  const children = new Map<Id, Id[]>();
  for (const [id, group] of collectionMap(ctx.doc, 'groups').entries()) {
    const parent = group.get('parent');
    if (typeof parent !== 'string') continue;
    children.set(parent, [...(children.get(parent) ?? []), id]);
  }
  const out = new Set<Id>();
  const stack = [...ids];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || out.has(id)) continue;
    out.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  return out;
}

export function groupSelection(ctx: EditContext, selection: GroupSelection): Id {
  const { nodes, groups, title, parent, frame, viewFrames = {} } = selection;
  if (title.trim() === '') {
    throw new DeckEditError('invalid', [{ path: 'title', message: 'A group needs a name.' }]);
  }
  const refs: Ref[] = [
    ...nodes.map((id, i): Ref => ({ path: `nodes.${String(i)}`, id, target: 'nodes' })),
    ...groups.map((id, i): Ref => ({ path: `groups.${String(i)}`, id, target: 'groups' })),
    ...(parent === undefined ? [] : [{ path: 'parent', id: parent, target: 'groups' } as const]),
  ];
  assertRefsExist(ctx.doc, refs, () => anchorableIds(ctx.doc));
  if (parent !== undefined && subtreeOf(ctx, groups).has(parent)) {
    throw new DeckEditError('invalid', [
      { path: 'parent', message: 'A group cannot go inside a group it contains.' },
    ]);
  }
  const views = Object.keys(viewFrames).map((viewId) => ({ viewId, ...resolveView(ctx, viewId) }));

  const id = ctx.allocate('group');
  const group = {
    id,
    title,
    ...(parent === undefined ? {} : { parent }),
    position: frame.position,
    size: frame.size,
  };
  assertValid(validateObject('groups', group));
  for (const [viewId, own] of Object.entries(viewFrames)) {
    assertValid(
      validateObject('groups', { id, title, ...own }).map((issue) => ({
        ...issue,
        path: `viewFrames.${viewId}.${issue.path}`,
      })),
    );
  }

  // Other views store their presets and frames first (untracked), like any first view edit.
  const targets = views
    .filter((v) => v.index > 0)
    .map(({ viewId }) => {
      const map = viewMap(ctx, viewId);
      materializeFrames(ctx, map);
      return { map, own: viewFrames[viewId] };
    });

  ctx.transact(() => {
    const groupList = collectionMap(ctx.doc, 'groups');
    insertAt(groupList, id, createObject('groups', group, ''));
    const nodeList = collectionMap(ctx.doc, 'nodes');
    for (const nodeId of nodes) nodeList.get(nodeId)?.set('group', id);
    for (const groupId of groups) groupList.get(groupId)?.set('parent', id);
    for (const { map, own } of targets) {
      const frames = map.get('groupFrames');
      if (own !== undefined && frames instanceof Y.Map) {
        (frames as Y.Map<unknown>).set(id, toY({ position: own.position, size: own.size }));
      }
    }
  });
  return id;
}

/** Outline tree view model (FR-024): groups nested by `parent`, components under their `group`. */
import type { SododeckFile } from '@sododeck/schema';
import { stickyLabel } from '@sododeck/model';

import type { Scope } from './visible-graph';
import { visibleGraph } from './visible-graph';
import { resolveLook, type CardLook } from './style/card-style';

export type OutlineItem =
  | { type: 'up'; id: 'up'; title: string; children: [] }
  | {
      type: 'group';
      id: string;
      title: string;
      count: number;
      children: OutlineItem[];
      look?: CardLook;
    }
  | { type: 'node'; id: string; title: string; kind: string; children: []; look?: CardLook };

/** The group's parent when it exists and does not lead back into a cycle; else undefined. */
function effectiveParents(deck: SododeckFile): Map<string, string | undefined> {
  const parentOf = new Map(deck.groups.map((g) => [g.id, g.parent]));
  const out = new Map<string, string | undefined>();
  for (const group of deck.groups) {
    const parent = group.parent;
    if (parent === undefined || !parentOf.has(parent)) {
      out.set(group.id, undefined);
      continue;
    }
    // Walk up; a loop back to this group (or any repeat) means a cycle: show it at the root.
    const seen = new Set([group.id]);
    let current: string | undefined = parent;
    let cyclic = false;
    while (current !== undefined && parentOf.has(current)) {
      if (seen.has(current)) {
        cyclic = true;
        break;
      }
      seen.add(current);
      current = parentOf.get(current);
    }
    out.set(group.id, cyclic ? undefined : parent);
  }
  return out;
}

/**
 * Title of the scope above `scope` in the drill-in trail; `rootTitle` is the view crumb ("System
 * view", 011 FR-004). Null at the top level.
 */
export function parentScopeTitle(
  deck: SododeckFile,
  scope: Scope,
  rootTitle: string,
): string | null {
  if (scope.group !== null) {
    const group = deck.groups.find((entry) => entry.id === scope.group);
    if (group?.parent !== undefined) {
      return deck.groups.find((entry) => entry.id === group.parent)?.title ?? rootTitle;
    }
    if (scope.node !== null)
      return deck.nodes.find((node) => node.id === scope.node)?.title ?? rootTitle;
    return rootTitle;
  }
  if (scope.node !== null) return rootTitle;
  return null;
}

/** Title of the innermost drill-in frame, or `rootTitle` (the view crumb) at the top level. */
export function drillScopeTitle(
  deck: Pick<SododeckFile, 'groups' | 'nodes'>,
  drill: readonly { kind: 'group' | 'node'; id: string }[],
  rootTitle: string,
): string {
  const current = drill.at(-1);
  if (current === undefined) return rootTitle;
  if (current.kind === 'group')
    return deck.groups.find((group) => group.id === current.id)?.title ?? rootTitle;
  return deck.nodes.find((node) => node.id === current.id)?.title ?? rootTitle;
}

export function buildOutline(
  deck: SododeckFile,
  scope?: Scope,
  rootTitle = 'System view',
): OutlineItem[] {
  const graph = scope === undefined ? null : visibleGraph(deck, scope, new Set());
  const scopedDeck =
    graph === null
      ? deck
      : (() => {
          const visibleNodeIds = new Set(graph.nodes);
          const visibleGroupIds = new Set(graph.groups);
          return {
            ...deck,
            nodes: deck.nodes.filter((node) => visibleNodeIds.has(node.id)),
            groups: deck.groups.filter((group) => visibleGroupIds.has(group.id)),
          };
        })();
  const parents = effectiveParents(scopedDeck);
  const groups = new Map<string, Extract<OutlineItem, { type: 'group' }>>();
  for (const g of scopedDeck.groups) {
    const look = resolveLook(g.style);
    groups.set(g.id, {
      type: 'group',
      id: g.id,
      title: g.title,
      count: 0,
      children: [],
      ...(look === undefined ? {} : { look }),
    });
  }
  const root: OutlineItem[] = [];
  for (const g of scopedDeck.groups) {
    const item = groups.get(g.id);
    if (!item) continue;
    const parent = parents.get(g.id);
    (parent === undefined ? root : (groups.get(parent)?.children ?? root)).push(item);
  }
  const loose: OutlineItem[] = [];
  for (const n of scopedDeck.nodes) {
    const look = resolveLook(n.style);
    const item: OutlineItem = {
      type: 'node',
      id: n.id,
      title: n.title,
      kind: n.type,
      children: [],
      ...(look === undefined ? {} : { look }),
    };
    const group = n.group === undefined ? undefined : groups.get(n.group);
    if (group) group.children.push(item);
    else loose.push(item);
  }
  const count = (item: OutlineItem): number =>
    item.type === 'node' || item.type === 'up'
      ? 1
      : (item.count = item.children.reduce((sum, child) => sum + count(child), 0));
  for (const item of root) count(item);
  const items = [...root, ...loose];
  const upTitle = scope === undefined ? null : parentScopeTitle(deck, scope, rootTitle);
  return upTitle === null
    ? items
    : [{ type: 'up', id: 'up', title: upTitle, children: [] }, ...items];
}

export interface VisibleItem {
  item: OutlineItem;
  level: number;
  parentId: string | null;
}

export interface NoteOutlineItem {
  id: string;
  label: string;
}

/** Depth-first list of the items that are shown (children of collapsed groups are not). */
export function visibleItems(
  tree: readonly OutlineItem[],
  collapsed: ReadonlySet<string>,
): VisibleItem[] {
  const out: VisibleItem[] = [];
  const walk = (items: readonly OutlineItem[], level: number, parentId: string | null) => {
    for (const item of items) {
      out.push({ item, level, parentId });
      if (item.type === 'group' && !collapsed.has(item.id)) walk(item.children, level + 1, item.id);
    }
  };
  walk(tree, 1, null);
  return out;
}

/** Notes outline rows, in file order, using the first non-empty line as the label. */
export function buildNotesOutline(deck: SododeckFile): NoteOutlineItem[] {
  return deck.stickies.map((sticky) => ({
    id: sticky.id,
    label: stickyLabel(sticky.text) ?? 'Empty note',
  }));
}

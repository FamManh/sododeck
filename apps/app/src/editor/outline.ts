/** Outline tree view model (FR-024): groups nested by `parent`, components under their `group`. */
import type { SododeckFile } from '@sododeck/schema';
import { stickyLabel } from '@sododeck/model';

export type OutlineItem =
  | { type: 'group'; id: string; title: string; count: number; children: OutlineItem[] }
  | { type: 'node'; id: string; title: string; kind: string; children: [] };

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

export function buildOutline(deck: SododeckFile): OutlineItem[] {
  const parents = effectiveParents(deck);
  const groups = new Map<string, Extract<OutlineItem, { type: 'group' }>>();
  for (const g of deck.groups) {
    groups.set(g.id, { type: 'group', id: g.id, title: g.title, count: 0, children: [] });
  }
  const root: OutlineItem[] = [];
  for (const g of deck.groups) {
    const item = groups.get(g.id);
    if (!item) continue;
    const parent = parents.get(g.id);
    (parent === undefined ? root : (groups.get(parent)?.children ?? root)).push(item);
  }
  const loose: OutlineItem[] = [];
  for (const n of deck.nodes) {
    const item: OutlineItem = {
      type: 'node',
      id: n.id,
      title: n.title,
      kind: n.type,
      children: [],
    };
    const group = n.group === undefined ? undefined : groups.get(n.group);
    if (group) group.children.push(item);
    else loose.push(item);
  }
  const count = (item: OutlineItem): number =>
    item.type === 'node'
      ? 1
      : (item.count = item.children.reduce((sum, child) => sum + count(child), 0));
  for (const item of root) count(item);
  return [...root, ...loose];
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

/**
 * ⌘G (016 research R11, FR-010–FR-012): the selection becomes a new group whose frame is fitted
 * around it, in the selection's innermost common group, then its label opens for a name. The
 * group is one undo step and the name another.
 */
import type { DeckEditor } from '@sododeck/model';
import type { Frame, Id, SododeckFile } from '@sododeck/schema';

import { readDeck } from '../../model/use-deck-snapshot';
import { useUiStore, type Selection } from '../../state/ui-store';
import { cardBox, GROUP_PADDING, groupBounds, type Rect } from '../canvas-geometry';
import { readViewState } from '../views/use-current-view';
import { commonParent } from './common-parent';
import { groupSubtree } from './subtree';

export const NEW_GROUP_TITLE = 'New group';

/** What a group of the selection holds: top-level items only (members of groups stay put). */
export function groupMembers(
  deck: Pick<SododeckFile, 'nodes' | 'groups'>,
  selection: Pick<Selection, 'nodes' | 'groups'>,
): { nodes: Id[]; groups: Id[] } {
  const selected = new Set(selection.groups);
  const byId = new Map(deck.groups.map((g) => [g.id, g]));
  // A selected group inside another selected group moves with it.
  const inner = new Set(
    groupSubtree(deck, selection.groups).groups.filter((id) => {
      const parent = byId.get(id)?.parent;
      return parent !== undefined && groupSubtree(deck, [...selected]).groups.includes(parent);
    }),
  );
  const groups = selection.groups.filter((id) => byId.has(id) && !inner.has(id));
  const carried = new Set(groupSubtree(deck, groups).nodes);
  const nodes = selection.nodes.filter((id) => !carried.has(id));
  return { nodes, groups };
}

/** The frame around `members` as `deck` draws them: full-detail cards and frames, plus padding. */
export function frameAround(
  deck: SododeckFile,
  members: { nodes: readonly Id[]; groups: readonly Id[] },
): Frame | null {
  const nodes = new Set(members.nodes);
  const bounds = groupBounds(deck, 'component');
  const rects: Rect[] = [];
  deck.nodes.forEach((node, index) => {
    if (nodes.has(node.id)) rects.push(cardBox(node, index, 'component'));
  });
  for (const id of members.groups) {
    const rect = bounds.get(id);
    if (rect !== undefined) rects.push(rect);
  }
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((r) => r.x)) - GROUP_PADDING;
  const top = Math.min(...rects.map((r) => r.y)) - GROUP_PADDING;
  const right = Math.max(...rects.map((r) => r.x + r.width)) + GROUP_PADDING;
  const bottom = Math.max(...rects.map((r) => r.y + r.height)) + GROUP_PADDING;
  return { position: { x: left, y: top }, size: { width: right - left, height: bottom - top } };
}

/** How many items ⌘G would group; it needs two or more. */
export function groupableCount(selection: Pick<Selection, 'nodes' | 'groups'>): number {
  return selection.nodes.length + selection.groups.length;
}

/** Groups the selection and opens the new label for a name. Returns the new id, or null. */
export function groupFromSelection(editor: DeckEditor, selection: Selection): Id | null {
  if (groupableCount(selection) < 2) return null;
  const deck = readDeck(editor.doc);
  const view = readViewState(editor.doc);
  const members = groupMembers(deck, selection);
  const frame = frameAround(deck, members);
  if (frame === null) return null;
  // A view with its own layout gets the frame it draws, too (R4).
  const own = view.isBase ? null : frameAround(view.deck, members);
  const id = editor.groupSelection({
    ...members,
    title: NEW_GROUP_TITLE,
    parent: commonParent(deck, members),
    frame,
    ...(own === null ? {} : { viewFrames: { [view.view.id]: own } }),
  });
  const ui = useUiStore.getState();
  ui.select({ groups: [id] });
  ui.startTitleEdit({ target: 'group', id, isNew: true });
  const count = groupSubtree(readDeck(editor.doc), [id]).nodes.length;
  ui.announce(`Grouped ${String(count)} ${count === 1 ? 'component' : 'components'}`);
  return id;
}

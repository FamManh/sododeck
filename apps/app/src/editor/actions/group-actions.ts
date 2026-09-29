import { ChevronsDownUp, SquareDashedMousePointer, Trash2, Ungroup } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import { COLLAPSED_NODE_PREFIX, GROUP_NODE_PREFIX } from '../deck-to-flow';
import { oneStep } from '../fields/one-step';
import { toggleGroupCollapsed } from '../views/use-current-view';
import type { Action, ActionContext } from './types';

const groupOf = (ctx: ActionContext) =>
  ctx.deck.groups.find((group) => group.id === ctx.selection.groups[0]);

const collapsed = (ctx: ActionContext) => {
  const id = ctx.selection.groups[0];
  return id !== undefined && ctx.view.collapsed.has(id);
};

/** Removes the group: its members and child groups move to the parent level (002), one step. */
function ungroup(ctx: ActionContext) {
  const group = groupOf(ctx);
  if (group === undefined) return;
  oneStep(ctx.editor, () => {
    ctx.editor.remove('groups', group.id);
  });
  useUiStore.getState().announce(`Ungrouped ${group.title}`);
}

/** Collapse / Expand, Select members, Ungroup and Delete group (019 FR-023, FR-032). */
export const GROUP_ACTIONS: readonly Action[] = [
  {
    id: 'group.ungroup',
    label: 'Ungroup',
    icon: Ungroup,
    shortcut: 'ungroup',
    section: 'edit',
    where: { toolbar: ['group'] },
    run: ungroup,
  },
  {
    id: 'group.collapse',
    label: (ctx) => (collapsed(ctx) ? 'Expand' : 'Collapse'),
    icon: ChevronsDownUp,
    shortcut: 'collapse',
    section: 'edit',
    where: { menu: ['group'], toolbar: ['group'] },
    run: (ctx) => {
      const group = groupOf(ctx);
      if (group === undefined) return;
      const now = toggleGroupCollapsed(ctx.editor, group.id);
      const ui = useUiStore.getState();
      ui.select({ groups: [group.id] });
      ui.focus(`${now ? COLLAPSED_NODE_PREFIX : GROUP_NODE_PREFIX}${group.id}`);
      ui.announce(`${group.title} ${now ? 'collapsed' : 'expanded'}`);
    },
  },
  {
    id: 'group.selectMembers',
    label: 'Select members',
    icon: SquareDashedMousePointer,
    section: 'edit',
    where: { menu: ['group'], toolbar: ['group'] },
    applies: (ctx) => ctx.deck.nodes.some((node) => node.group === ctx.selection.groups[0]),
    run: (ctx) => {
      const id = ctx.selection.groups[0];
      const members = ctx.deck.nodes.filter((node) => node.group === id).map((node) => node.id);
      const ui = useUiStore.getState();
      ui.select({ nodes: members });
      ui.announce(`${String(members.length)} selected`);
    },
  },
  {
    id: 'group.delete',
    label: 'Delete group',
    icon: Trash2,
    section: 'danger',
    destructive: true,
    description: 'Members move to the parent level',
    where: { menu: ['group'] },
    run: ungroup,
  },
];

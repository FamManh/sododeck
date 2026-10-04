import { ChevronsDownUp, Group, SquareDashedMousePointer, Trash2, Ungroup } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import { COLLAPSED_NODE_PREFIX, GROUP_NODE_PREFIX } from '../deck-to-flow';
import { groupableCount, groupFromSelection } from '../editing/group-from-selection';
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
  // The model deletes the group's own connectors with it (050, ADR 0030); say so, since they vanish.
  const connectors = ctx.deck.edges.filter((e) => e.from === group.id || e.to === group.id).length;
  oneStep(ctx.editor, () => {
    ctx.editor.remove('groups', group.id);
  });
  const also =
    connectors === 0
      ? ''
      : ` · also deleted ${String(connectors)} connection${connectors === 1 ? '' : 's'}`;
  useUiStore.getState().announce(`Ungrouped ${group.title}${also}`);
}

/**
 * Group (⌘G, 016 R11), Collapse / Expand, Select members, Ungroup and Delete group (019 FR-023,
 * FR-032).
 */
export const GROUP_ACTIONS: readonly Action[] = [
  {
    id: 'group.create',
    label: 'Group',
    icon: Group,
    shortcut: 'group',
    toolbarText: true,
    // With Align and Arrange, after the clipboard items (screens 99, 102).
    section: 'arrange',
    where: { menu: ['component', 'components', 'mixed'], toolbar: ['components'] },
    applies: (ctx) => ctx.selection.edges.length === 0 && ctx.selection.stickies.length === 0,
    disabledReason: (ctx) =>
      groupableCount(ctx.selection) < 2 ? 'Select two or more components' : null,
    run: (ctx) => {
      groupFromSelection(ctx.editor, ctx.selection);
    },
  },
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

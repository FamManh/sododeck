import { isSchemaGroupId } from '@sododeck/model';
import { Layers, PanelRight, Pencil } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import { groupTitleOf } from '../schema-groups';
import { isNodeLocked, LOCKED_HINT } from '../lock';
import type { Action, ActionContext } from './types';

const onlyNode = (ctx: ActionContext) =>
  ctx.target.kind === 'component' ? ctx.selection.nodes[0] : undefined;

const onlyGroup = (ctx: ActionContext) =>
  ctx.target.kind === 'group' && ctx.selection.groups.length === 1
    ? ctx.selection.groups[0]
    : undefined;

/** Open details, Open inside, Rename (019 R8). */
export const TITLE_ACTIONS: readonly Action[] = [
  {
    id: 'details.open',
    label: 'Open details',
    icon: PanelRight,
    shortcut: 'open-details',
    section: 'open',
    where: {
      menu: ['component', 'components', 'connection', 'group', 'sticky'],
      toolbar: ['component'],
    },
    modes: ['edit', 'flow', 'session', 'viewOnly'],
    run: (ctx) => {
      const ui = useUiStore.getState();
      // In flow mode selecting would leave the flow; the drawer shows what is selected there.
      if (ctx.mode === 'edit') ui.select(ctx.selection);
      const [node] = ctx.selection.nodes;
      if (node !== undefined && ctx.selection.nodes.length === 1) ui.focus(node);
      ui.openDrawer();
    },
  },
  {
    id: 'node.openInside',
    label: 'Open inside',
    icon: Layers,
    shortcut: 'open-details',
    section: 'open',
    // Double-click renames a group frame, so the menu is the pointer's way into a group.
    where: { menu: ['component', 'group'] },
    applies: (ctx) => {
      if (onlyGroup(ctx) !== undefined) return true;
      const id = onlyNode(ctx);
      return id !== undefined && (ctx.childCount.get(id) ?? 0) > 0;
    },
    run: (ctx) => {
      const group = onlyGroup(ctx);
      if (group !== undefined) {
        const title = groupTitleOf(ctx.deck, group);
        if (title === undefined || ctx.canvas === null) return;
        const ui = useUiStore.getState();
        ui.drillInto({ kind: 'group', id: group, viewport: ctx.canvas.getViewport() });
        ui.announce(`Opened ${title}`);
        return;
      }
      const id = onlyNode(ctx);
      const title = ctx.deck.nodes.find((node) => node.id === id)?.title;
      if (id === undefined || title === undefined || ctx.canvas === null) return;
      const ui = useUiStore.getState();
      ui.drillInto({ kind: 'node', id, viewport: ctx.canvas.getViewport() });
      ui.announce(`Opened ${title}`);
    },
  },
  {
    id: 'title.rename',
    label: 'Rename',
    icon: Pencil,
    shortcut: 'rename',
    section: 'open',
    where: { menu: ['component', 'group'], toolbar: ['group'] },
    // A derived schema group (048) is named by its schema: nothing to rename.
    applies: (ctx) => !isSchemaGroupId(onlyGroup(ctx) ?? ''),
    // A locked card keeps its title (043 FR-023).
    disabledReason: (ctx) => {
      const node = onlyNode(ctx);
      return node !== undefined && isNodeLocked(ctx.deck, node) ? LOCKED_HINT : null;
    },
    run: (ctx) => {
      const ui = useUiStore.getState();
      const [group] = ctx.selection.groups;
      const node = onlyNode(ctx);
      if (ctx.target.kind === 'group' && group !== undefined) {
        ui.startTitleEdit({ target: 'group', id: group, isNew: false });
      } else if (node !== undefined) {
        ui.select({ nodes: [node] });
        ui.focus(node);
        ui.startTitleEdit({ target: 'node', id: node, isNew: false });
      }
    },
  },
];

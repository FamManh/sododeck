/**
 * The selection toolbar/menu's colour action (020 T031, contract "Actions"): opens the style
 * popover. The button's mini swatch and name reflect the fill, or the stroke when there is no
 * fill on any selected component or group.
 */
import { effectiveFamily } from '@sododeck/model';
import type { Group, Node } from '@sododeck/schema';
import { nodeIcon, type ResolvedIcon } from '@sododeck/ui/icon-sets';
import type { ColorRef, Style } from '@sododeck/schema';

import { useUiStore, type ToolbarFieldId } from '../../state/ui-store';
import { styleView, type Shared } from '../inspector/derive';
import { colourName, resolveLook } from '../style/card-style';
import type { Action, ActionContext } from './types';

const open = (field: ToolbarFieldId) => () => {
  useUiStore.getState().openToolbarField(field);
};

/** The selected components and groups, in deck order (nodes, then groups). */
function selectedStyled(ctx: ActionContext): (Pick<Node, 'style'> | Pick<Group, 'style'>)[] {
  const nodeIds = new Set(ctx.selection.nodes);
  const groupIds = new Set(ctx.selection.groups);
  return [
    ...ctx.deck.nodes.filter((node) => nodeIds.has(node.id)),
    ...ctx.deck.groups.filter((group) => groupIds.has(group.id)),
  ];
}

interface Displayed {
  channel: 'fill' | 'stroke';
  ref: Shared<ColorRef | null>;
}

/** The channel the button shows: the fill, or the stroke when there is no fill (020 R6). */
function displayed(ctx: ActionContext): Displayed {
  const view = styleView(selectedStyled(ctx));
  return view.fill.mixed || view.fill.value !== null
    ? { channel: 'fill', ref: view.fill }
    : { channel: 'stroke', ref: view.stroke };
}

const colourLabel = (ctx: ActionContext): string => {
  const { ref } = displayed(ctx);
  return ref.mixed ? 'Mixed' : ref.value === null ? 'none' : colourName(ref.value);
};

const colourSwatch = (ctx: ActionContext): string | null => {
  const { channel, ref } = displayed(ctx);
  if (ref.mixed || ref.value === null) return null;
  const style: Style = channel === 'fill' ? { fill: ref.value } : { stroke: ref.value };
  return resolveLook(style)?.[channel] ?? null;
};

/**
 * The colour action (020 R6): offered on components, groups and mixed selections, not
 * connections, stickies or the canvas; opens `StylePicker` in its popover.
 */
const COLOUR_ACTIONS: readonly Action[] = [
  {
    id: 'style.colour',
    label: (ctx) => `Colour: ${colourLabel(ctx)}`,
    swatch: colourSwatch,
    section: 'edit',
    field: 'style',
    where: {
      toolbar: ['component', 'components', 'group', 'mixed'],
      menu: ['component', 'components', 'group', 'mixed'],
    },
    run: open('style'),
  },
];

const selectedCards = (ctx: ActionContext): Node[] => {
  const ids = new Set(ctx.selection.nodes);
  return ctx.deck.nodes.filter((node) => ids.has(node.id) && effectiveFamily(node) === 'card');
};

/** The icon every selected card draws, or `'mixed'` when they differ (038). */
function sharedIcon(ctx: ActionContext): ResolvedIcon | 'mixed' {
  const icons = selectedCards(ctx).map(
    (node) => nodeIcon({ icon: node.icon, type: node.type }).icon,
  );
  const [first] = icons;
  if (first === undefined) return 'mixed';
  return icons.every((icon) => icon === first) ? first : 'mixed';
}

/**
 * The icon action (038): offered when at least one selected node is drawn as a card. Shapes draw
 * their outline, so they are never offered an icon and keep whatever is stored.
 */
const ICON_ACTIONS: readonly Action[] = [
  {
    id: 'style.icon',
    label: 'Icon…',
    toolbarLabel: 'Icon',
    glyph: sharedIcon,
    section: 'edit',
    field: 'icon',
    where: {
      toolbar: ['component', 'components', 'mixed'],
      menu: ['component', 'components', 'mixed'],
    },
    applies: (ctx) => selectedCards(ctx).length > 0,
    run: open('icon'),
  },
];

export const STYLE_ACTIONS: readonly Action[] = [...COLOUR_ACTIONS, ...ICON_ACTIONS];

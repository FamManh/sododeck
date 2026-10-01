import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  type LucideIcon,
} from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import { cardSize, displayPosition } from '../canvas-geometry';
import {
  align,
  distribute,
  type AlignMode,
  type DistributeAxis,
  type IdRect,
} from '../editing/align';
import { oneStep } from '../fields/one-step';
import { effectiveLevel, levelForZoom } from '../levels';
import type { ShortcutId } from '../shell/shortcuts';
import { scopeOf } from '../visible-graph';
import type { Action, ActionContext } from './types';

const plural = (n: number) => `${String(n)} ${n === 1 ? 'component' : 'components'}`;

/** The selected cards as the canvas shows them now: each card's own size (R12, SC-004, 017 R2). */
function selectedRects(ctx: ActionContext): IdRect[] {
  const zoom = ctx.canvas?.getViewport().zoom;
  const level =
    zoom === undefined
      ? 'component'
      : effectiveLevel(levelForZoom(zoom), scopeOf(useUiStore.getState().drill));
  const ids = new Set(ctx.selection.nodes);
  return ctx.view.deck.nodes.flatMap((node, index) =>
    ids.has(node.id)
      ? [{ id: node.id, ...displayPosition(node, index), ...cardSize(node, level) }]
      : [],
  );
}

function write(ctx: ActionContext, positions: Record<string, { x: number; y: number }>) {
  if (Object.keys(positions).length === 0) return;
  oneStep(ctx.editor, () => {
    ctx.editor.moveInView(ctx.view.view.id, positions);
  });
}

/** Aligns the selected components (⌥A / ⌥D / ⌥W / ⌥S and Align ▸): one undo step. */
export function alignSelection(ctx: ActionContext, mode: AlignMode): boolean {
  const rects = selectedRects(ctx);
  if (rects.length < 2) return false;
  write(ctx, align(rects, mode));
  useUiStore.getState().announce(`Aligned ${plural(rects.length)} ${mode}`);
  return true;
}

export function distributeSelection(ctx: ActionContext, axis: DistributeAxis): boolean {
  const rects = selectedRects(ctx);
  if (rects.length < 3) return false;
  write(ctx, distribute(rects, axis));
  useUiStore.getState().announce(`Distributed ${plural(rects.length)} ${axis}ly`);
  return true;
}

const ALIGN: readonly {
  mode: AlignMode;
  label: string;
  icon: LucideIcon;
  shortcut?: ShortcutId;
  separatorBefore?: boolean;
}[] = [
  { mode: 'left', label: 'Align left', icon: AlignStartVertical, shortcut: 'align-left' },
  { mode: 'centre', label: 'Align centre', icon: AlignCenterVertical },
  { mode: 'right', label: 'Align right', icon: AlignEndVertical, shortcut: 'align-right' },
  {
    mode: 'top',
    label: 'Align top',
    icon: AlignStartHorizontal,
    shortcut: 'align-top',
    separatorBefore: true,
  },
  { mode: 'middle', label: 'Align middle', icon: AlignCenterHorizontal },
  { mode: 'bottom', label: 'Align bottom', icon: AlignEndHorizontal, shortcut: 'align-bottom' },
];

const THREE = (ctx: ActionContext) =>
  ctx.selection.nodes.length < 3 ? 'Select three or more components' : null;

/** Align ▸ (016 R12, contract "Align ▸ submenu"): six alignments and two distributions. */
export const ALIGN_ACTIONS: readonly Action[] = [
  {
    id: 'arrange.align',
    label: 'Align',
    icon: AlignStartVertical,
    section: 'arrange',
    where: { menu: ['component', 'components'], toolbar: ['components'] },
    disabledReason: (ctx) =>
      ctx.selection.nodes.length < 2 ? 'Select two or more components' : null,
    children: () => [
      ...ALIGN.map(({ mode, ...item }): Action => ({
        id: `arrange.align.${mode}`,
        ...item,
        section: 'arrange',
        where: {},
        run: (ctx) => {
          alignSelection(ctx, mode);
        },
      })),
      {
        id: 'arrange.distribute.horizontal',
        label: 'Distribute horizontally',
        icon: AlignHorizontalSpaceAround,
        separatorBefore: true,
        section: 'arrange',
        where: {},
        disabledReason: THREE,
        run: (ctx) => {
          distributeSelection(ctx, 'horizontal');
        },
      },
      {
        id: 'arrange.distribute.vertical',
        label: 'Distribute vertically',
        icon: AlignVerticalSpaceAround,
        section: 'arrange',
        where: {},
        disabledReason: THREE,
        run: (ctx) => {
          distributeSelection(ctx, 'vertical');
        },
      },
    ],
  },
];

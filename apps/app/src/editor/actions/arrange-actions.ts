import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, Layers2 } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import { LOCKED_HINT } from '../lock';
import { oneStep } from '../fields/one-step';
import type { Action, ActionContext } from './types';

type Move = 'front' | 'back' | 'forward' | 'backward';

const DONE: Record<Move, string> = {
  front: 'brought to front',
  back: 'sent to back',
  forward: 'brought forward',
  backward: 'sent backward',
};

/** The picked pictures that are not locked: a locked picture keeps its place in the stack (055). */
const freeImages = (ctx: ActionContext) => {
  const locked = new Set(
    (ctx.deck.images ?? []).filter((image) => image.locked === true).map((image) => image.id),
  );
  return ctx.selection.images.filter((id) => !locked.has(id));
};

/**
 * Stacking over cards and pictures together (019 FR-037, 055 R2): one shared order, so a picture
 * can sit above one card and below another. One undo step; locked pictures are left out.
 */
function arrange(ctx: ActionContext, move: Move) {
  const nodes = ctx.selection.nodes;
  const images = freeImages(ctx);
  if (nodes.length + images.length === 0) return;
  oneStep(ctx.editor, () => {
    const targets = { nodes, images };
    if (move === 'front') ctx.editor.bringToFront(targets);
    else if (move === 'back') ctx.editor.sendToBack(targets);
    else if (move === 'forward') ctx.editor.bringForward(targets);
    else ctx.editor.sendBackward(targets);
  });
  const n = nodes.length + images.length;
  const only = nodes.length === 0 ? 'Image' : images.length === 0 ? 'Component' : 'Item';
  useUiStore
    .getState()
    .announce(`${n === 1 ? only : `${String(n)} ${only.toLowerCase()}s`} ${DONE[move]}`);
}

const MENU_KINDS = ['component', 'components', 'image', 'images', 'mixed'] as const;
const TOOLBAR_KINDS = ['image', 'images'] as const;

/** Why stacking is refused: every picked picture is locked and nothing else is picked. */
const lockedReason = (ctx: ActionContext) =>
  ctx.selection.nodes.length === 0 &&
  ctx.selection.images.length > 0 &&
  freeImages(ctx).length === 0
    ? LOCKED_HINT
    : null;

const applies = (ctx: ActionContext) =>
  ctx.selection.nodes.length + ctx.selection.images.length > 0;

const child = (id: string, label: string, icon: Action['icon'], move: Move): Action => ({
  id,
  label,
  icon,
  section: 'arrange',
  where: {},
  disabledReason: lockedReason,
  run: (ctx) => {
    arrange(ctx, move);
  },
});

/** Arrange ▸ Bring to front / Bring forward / Send backward / Send to back (019 FR-037, 055). */
export const ARRANGE_ACTIONS: readonly Action[] = [
  {
    id: 'arrange',
    label: 'Arrange',
    icon: Layers2,
    section: 'arrange',
    where: { menu: MENU_KINDS },
    applies,
    children: () => [
      child('arrange.front', 'Bring to front', ArrowUpToLine, 'front'),
      child('arrange.forward', 'Bring forward', ArrowUp, 'forward'),
      child('arrange.backward', 'Send backward', ArrowDown, 'backward'),
      child('arrange.back', 'Send to back', ArrowDownToLine, 'back'),
    ],
  },
  {
    id: 'arrange.toolbar.forward',
    label: 'Bring forward',
    icon: ArrowUp,
    section: 'arrange',
    where: { toolbar: TOOLBAR_KINDS },
    applies,
    disabledReason: lockedReason,
    run: (ctx) => {
      arrange(ctx, 'forward');
    },
  },
  {
    id: 'arrange.toolbar.backward',
    label: 'Send backward',
    icon: ArrowDown,
    section: 'arrange',
    where: { toolbar: TOOLBAR_KINDS },
    applies,
    disabledReason: lockedReason,
    run: (ctx) => {
      arrange(ctx, 'backward');
    },
  },
];

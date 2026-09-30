/**
 * Reset size (017 R4, FR-006): a resized card back to its level's default, one undo step.
 */
import { Scaling } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import { oneStep } from '../fields/one-step';
import type { Action, ActionContext } from './types';

const onlyNode = (ctx: ActionContext) =>
  ctx.target.kind === 'component' ? ctx.selection.nodes[0] : undefined;

export const SHAPE_ACTIONS: readonly Action[] = [
  {
    id: 'node.resetSize',
    label: 'Reset size',
    icon: Scaling,
    section: 'edit',
    where: { menu: ['component'] },
    disabledReason: (ctx) => {
      const id = onlyNode(ctx);
      const node = ctx.deck.nodes.find((n) => n.id === id);
      return node?.size === undefined ? 'Default size' : null;
    },
    run: (ctx) => {
      const id = onlyNode(ctx);
      if (id === undefined) return;
      oneStep(ctx.editor, () => {
        ctx.editor.setCardSize(id, null);
      });
      useUiStore.getState().announce('Size reset');
    },
  },
];

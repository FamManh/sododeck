import { ArrowDownToLine, ArrowUpToLine, Layers2 } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import { oneStep } from '../fields/one-step';
import { arrangeOrder, reorderSteps } from './arrange-order';
import type { Action, ActionContext } from './types';

/** Moves the selected components to the end (front) or start (back) of `deck.nodes`: one step. */
function arrange(ctx: ActionContext, direction: 'front' | 'back') {
  const order = ctx.deck.nodes.map((node) => node.id);
  const steps = reorderSteps(order, arrangeOrder(order, ctx.selection.nodes, direction));
  if (steps.length === 0) return;
  oneStep(ctx.editor, () => {
    ctx.editor.batch(() => {
      for (const { id, index } of steps) ctx.editor.reorder('nodes', id, index);
    });
  });
  const n = ctx.selection.nodes.length;
  useUiStore
    .getState()
    .announce(
      `${n === 1 ? 'Component' : `${String(n)} components`} ${direction === 'front' ? 'brought to front' : 'sent to back'}`,
    );
}

/** Arrange ▸ Bring to front / Send to back (019 FR-037). */
export const ARRANGE_ACTIONS: readonly Action[] = [
  {
    id: 'arrange',
    label: 'Arrange',
    icon: Layers2,
    section: 'arrange',
    where: { menu: ['component', 'components'] },
    children: () => [
      {
        id: 'arrange.front',
        label: 'Bring to front',
        icon: ArrowUpToLine,
        section: 'arrange',
        where: {},
        run: (ctx) => {
          arrange(ctx, 'front');
        },
      },
      {
        id: 'arrange.back',
        label: 'Send to back',
        icon: ArrowDownToLine,
        section: 'arrange',
        where: {},
        run: (ctx) => {
          arrange(ctx, 'back');
        },
      },
    ],
  },
];

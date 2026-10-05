/**
 * Reset size (017 R4, FR-006): a resized card back to its level's default, one undo step.
 * Reset route (017 R12, 022): a connection's pinned sides, offset, bends and anchors back to
 * automatic.
 */
import { edgeShape, isLocked } from '@sododeck/model';
import { RotateCcw, Scaling } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import { oneStep } from '../fields/one-step';
import { LOCKED_HINT } from '../lock';
import { hasCustomRoute } from '../routing/route-state';
import type { Action, ActionContext } from './types';

const onlyNode = (ctx: ActionContext) =>
  ctx.target.kind === 'component' ? ctx.selection.nodes[0] : undefined;

const edgeOf = (ctx: ActionContext) =>
  ctx.deck.edges.find((edge) => edge.id === ctx.selection.edges[0]);

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
  {
    id: 'edge.resetRoute',
    label: 'Reset route',
    icon: RotateCcw,
    section: 'edit',
    where: { menu: ['connection'], toolbar: ['connection'] },
    // Pinned sides mean something on an elbow line (029); bends, anchors and an offset on any.
    applies: (ctx) => {
      const edge = edgeOf(ctx);
      return edge !== undefined && (edgeShape(edge) === 'elbow' || hasCustomRoute(edge));
    },
    disabledReason: (ctx) => {
      const edge = edgeOf(ctx);
      if (edge !== undefined && isLocked(edge)) return LOCKED_HINT;
      return edge?.route === undefined ? 'Route is automatic' : null;
    },
    run: (ctx) => {
      const edge = edgeOf(ctx);
      if (edge === undefined) return;
      oneStep(ctx.editor, () => {
        ctx.editor.setEdgeRoute(edge.id, null);
      });
      useUiStore.getState().announce('Route reset');
    },
  },
];

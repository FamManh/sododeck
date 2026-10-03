/**
 * Show as card / shape (031 US3, research R4): decision, database and document draw either way.
 * One radio choice in the toolbar and the context menu; the drawer has the same as a radio group
 * (`inspector/show-as-field.tsx`). Only the form changes: `node.display`, one undo step.
 */
import { effectiveFamily, hasTwoForms, type NodeDisplay } from '@sododeck/model';
import { Shapes } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import type { Action, ActionContext } from './types';

type Form = 'card' | 'shape';

const FORMS: readonly { value: NodeDisplay; label: string }[] = [
  { value: 'card', label: 'Show as card' },
  { value: 'shape', label: 'Show as shape' },
];

/** The selected nodes, when every one of them has two forms; otherwise none. */
function twoFormNodes(ctx: ActionContext) {
  const ids = new Set(ctx.selection.nodes);
  const nodes = ctx.deck.nodes.filter((node) => ids.has(node.id));
  return nodes.length > 0 && nodes.length === ids.size && nodes.every((n) => hasTwoForms(n.type))
    ? nodes
    : [];
}

/** The form all selected objects share, or `'mixed'`. */
export function sharedForm(
  nodes: readonly Parameters<typeof effectiveFamily>[0][],
): Form | 'mixed' {
  const forms = new Set(nodes.map((node) => effectiveFamily(node)));
  const [only] = forms;
  return forms.size === 1 && only !== undefined ? only : 'mixed';
}

/** One undo step for the whole selection, announced once. */
export function showAs(ctx: Pick<ActionContext, 'editor'>, ids: readonly string[], form: Form) {
  ctx.editor.setNodeDisplay(ids, form);
  useUiStore.getState().announce(form === 'shape' ? 'Shown as shape' : 'Shown as card');
}

const FORM_NAME = { card: 'Card', shape: 'Shape', mixed: 'Mixed' } as const;

export const SHAPE_FORM_ACTIONS: readonly Action[] = [
  {
    id: 'node.showAs',
    label: 'Show as',
    toolbarLabel: (ctx) => `Show as: ${FORM_NAME[sharedForm(twoFormNodes(ctx))]}`,
    icon: Shapes,
    section: 'edit',
    where: { menu: ['component', 'components'], toolbar: ['component', 'components'] },
    applies: (ctx) => twoFormNodes(ctx).length > 0,
    radio: true,
    children: () =>
      FORMS.map(({ value, label }) => ({
        id: `node.showAs.${value}`,
        label,
        section: 'edit',
        where: {},
        checked: (ctx) => sharedForm(twoFormNodes(ctx)) === value,
        run: (ctx) => {
          showAs(
            ctx,
            twoFormNodes(ctx).map((node) => node.id),
            value,
          );
        },
      })),
  },
];

/**
 * Relationship quick settings (043 R9, FR-014, frame 136): cardinality, optional sides and the
 * on delete action of one relationship, from its menu and its toolbar. Only relationships drawn
 * from rows (column ends) get them; line type and colour stay the connector's own actions.
 * Optional flags are written `true` or removed, never `false`; "None" removes `onDelete`.
 */
import type { Cardinality, DbAction, Edge } from '@sododeck/schema';
import { GitFork, Trash } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import { oneStep } from '../fields/one-step';
import { hasColumnEnds } from '../relationships/relationship-ends';
import type { Action, ActionContext } from './types';

/** The one selected connection, when it is a relationship drawn from rows. */
function relationshipOf(ctx: ActionContext): Edge | undefined {
  const [id, ...rest] = ctx.selection.edges;
  if (id === undefined || rest.length > 0) return undefined;
  const edge = ctx.deck.edges.find((e) => e.id === id);
  return edge !== undefined && hasColumnEnds(edge) ? edge : undefined;
}

function write(
  ctx: ActionContext,
  patch: Parameters<ActionContext['editor']['update']>[2],
  said: string,
) {
  const edge = relationshipOf(ctx);
  if (edge === undefined) return;
  oneStep(ctx.editor, () => {
    ctx.editor.update('edges', edge.id, patch);
  });
  useUiStore.getState().announce(said);
}

/** "1–n" for `1-n`: the en dash reads as a range in the menu. */
export const cardinalityLabel = (value: Cardinality) => value.replace('-', '–');

const CARDINALITIES: readonly Cardinality[] = ['1-1', '1-n', 'n-1', 'n-n'];

export const ON_DELETE: readonly { value: DbAction | 'none'; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'cascade', label: 'Cascade' },
  { value: 'restrict', label: 'Restrict' },
  { value: 'set-null', label: 'Set null' },
  { value: 'set-default', label: 'Set default' },
  { value: 'no-action', label: 'No action' },
];

const onDeleteLabel = (edge: Edge | undefined) =>
  ON_DELETE.find((choice) => choice.value === (edge?.onDelete ?? 'none'))?.label ?? 'None';

const isRelationshipEdge = (ctx: ActionContext) => relationshipOf(ctx) !== undefined;

export const RELATIONSHIP_ACTIONS: readonly Action[] = [
  {
    id: 'relationship.cardinality',
    label: 'Cardinality',
    toolbarLabel: (ctx) => {
      const value = relationshipOf(ctx)?.cardinality;
      return `Cardinality: ${value === undefined ? 'none' : cardinalityLabel(value)}`;
    },
    icon: GitFork,
    section: 'edit',
    where: { menu: ['connection'], toolbar: ['connection'] },
    applies: isRelationshipEdge,
    radio: true,
    children: () =>
      CARDINALITIES.map((value) => ({
        id: `relationship.cardinality.${value}`,
        label: cardinalityLabel(value),
        section: 'edit',
        where: {},
        checked: (ctx) => relationshipOf(ctx)?.cardinality === value,
        run: (ctx) => {
          write(ctx, { cardinality: value }, `Cardinality ${cardinalityLabel(value)}`);
        },
      })),
  },
  {
    id: 'relationship.optional',
    label: 'Optional sides',
    section: 'edit',
    where: { menu: ['connection'] },
    applies: isRelationshipEdge,
    children: () =>
      (['from', 'to'] as const).map((side) => {
        const key = side === 'from' ? 'fromOptional' : 'toOptional';
        const label = side === 'from' ? 'From side optional' : 'To side optional';
        return {
          id: `relationship.optional.${side}`,
          label,
          section: 'edit',
          where: {},
          checked: (ctx: ActionContext) => relationshipOf(ctx)?.[key] === true,
          run: (ctx: ActionContext) => {
            const on = relationshipOf(ctx)?.[key] !== true;
            write(ctx, { [key]: on ? true : null }, `${label} ${on ? 'on' : 'off'}`);
          },
        };
      }),
  },
  {
    id: 'relationship.onDelete',
    label: 'On delete',
    toolbarLabel: (ctx) => `On delete: ${onDeleteLabel(relationshipOf(ctx))}`,
    icon: Trash,
    section: 'edit',
    where: { menu: ['connection'], toolbar: ['connection'] },
    applies: isRelationshipEdge,
    radio: true,
    children: () =>
      ON_DELETE.map(({ value, label }) => ({
        id: `relationship.onDelete.${value}`,
        label,
        section: 'edit',
        where: {},
        checked: (ctx) => (relationshipOf(ctx)?.onDelete ?? 'none') === value,
        run: (ctx) => {
          write(ctx, { onDelete: value === 'none' ? null : value }, `On delete: ${label}`);
        },
      })),
  },
];

import type { Edge } from '@sododeck/schema';
import { ArrowRightLeft, Cable, Spline, Type } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import { DIRECTIONS, PROTOCOLS, protocolLabel } from '../fields/edge-choices';
import { applyLineType, LINE_TYPES, lineTypeLabel, sharedLineShape } from '../fields/line-type';
import { oneStep } from '../fields/one-step';
import type { Action, ActionContext } from './types';

const edgeOf = (ctx: ActionContext): Edge | undefined =>
  ctx.deck.edges.find((edge) => edge.id === ctx.selection.edges[0]);

function setEdge(
  ctx: ActionContext,
  patch: Parameters<ActionContext['editor']['update']>[2],
  said: string,
) {
  const edge = edgeOf(ctx);
  if (edge === undefined) return;
  oneStep(ctx.editor, () => {
    ctx.editor.update('edges', edge.id, patch);
  });
  useUiStore.getState().announce(said);
}

/** The selected connections (one or several), in selection order, skipping stale ids. */
const selectedEdges = (ctx: ActionContext): Edge[] =>
  ctx.selection.edges.flatMap((id) => ctx.deck.edges.filter((edge) => edge.id === id));

/** Edit label, Protocol ▸ and Direction ▸ on one connection (019 FR-022, FR-031). */
export const CONNECTION_ACTIONS: readonly Action[] = [
  {
    id: 'edge.label',
    label: 'Edit label',
    toolbarLabel: 'Label',
    icon: Type,
    shortcut: 'open-details',
    section: 'open',
    where: { menu: ['connection'], toolbar: ['connection'] },
    run: (ctx) => {
      const edge = edgeOf(ctx);
      if (edge === undefined) return;
      const ui = useUiStore.getState();
      ui.select({ edges: [edge.id] });
      ui.openEdgePopover(edge.id);
    },
  },
  {
    id: 'edge.protocol',
    label: 'Protocol',
    toolbarLabel: (ctx) => `Protocol: ${protocolLabel(edgeOf(ctx)?.protocol) ?? 'none'}`,
    icon: Cable,
    shortcut: 'connection-protocol',
    section: 'open',
    field: 'protocol',
    where: { menu: ['connection'], toolbar: ['connection'] },
    radio: true,
    run: () => {
      useUiStore.getState().openToolbarField('protocol');
    },
    children: () =>
      PROTOCOLS.map(({ value, label }) => ({
        id: `edge.protocol.${value}`,
        label,
        section: 'open',
        where: {},
        checked: (ctx) => edgeOf(ctx)?.protocol === value,
        run: (ctx) => {
          setEdge(ctx, { protocol: value }, `Protocol set to ${label}`);
        },
      })),
  },
  {
    id: 'edge.direction',
    label: 'Direction',
    toolbarLabel: (ctx) => {
      const direction = edgeOf(ctx)?.direction ?? 'forward';
      return `Direction: ${DIRECTIONS.find((d) => d.value === direction)?.label ?? direction}`;
    },
    icon: ArrowRightLeft,
    section: 'open',
    field: 'direction',
    where: { menu: ['connection'], toolbar: ['connection'] },
    radio: true,
    children: () =>
      DIRECTIONS.map(({ value, label }) => ({
        id: `edge.direction.${value}`,
        label,
        section: 'open',
        where: {},
        checked: (ctx) => (edgeOf(ctx)?.direction ?? 'forward') === value,
        run: (ctx) => {
          setEdge(ctx, { direction: value }, `Direction set to ${label}`);
        },
      })),
  },
  {
    id: 'connection.lineType',
    label: 'Line type',
    toolbarLabel: (ctx) => {
      const shape = sharedLineShape(selectedEdges(ctx));
      return `Line type: ${shape === null ? 'mixed' : lineTypeLabel(shape)}`;
    },
    icon: Spline,
    section: 'edit',
    where: {
      menu: ['connection', 'connections'],
      toolbar: ['connection', 'connections'],
    },
    radio: true,
    children: () =>
      LINE_TYPES.map(({ value, label, icon }) => ({
        id: `connection.lineType.${value}`,
        label,
        icon,
        section: 'edit',
        where: {},
        checked: (ctx) => sharedLineShape(selectedEdges(ctx)) === value,
        run: (ctx) => {
          applyLineType(
            ctx.editor,
            selectedEdges(ctx).map((edge) => edge.id),
            value,
          );
        },
      })),
  },
];

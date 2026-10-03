import { edgeShape } from '@sododeck/model';
import type { Edge, EdgeShape } from '@sododeck/schema';
import { ArrowRightLeft, Cable, CornerDownRight, Minus, Spline, Type } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import { DIRECTIONS, PROTOCOLS, protocolLabel } from '../fields/edge-choices';
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

const LINE_TYPES: readonly { value: EdgeShape; label: string; icon: LucideIcon }[] = [
  { value: 'curved', label: 'Curved', icon: Spline },
  { value: 'elbow', label: 'Elbow', icon: CornerDownRight },
  { value: 'straight', label: 'Straight', icon: Minus },
];

const lineLabel = (shape: EdgeShape) => LINE_TYPES.find((t) => t.value === shape)?.label ?? shape;

/** The selected connections (one or several), in selection order, skipping stale ids. */
function selectedEdges(ctx: ActionContext): Edge[] {
  return ctx.selection.edges.flatMap((id) => ctx.deck.edges.filter((edge) => edge.id === id));
}

/** The shape every selected connection shares, or `null` when they differ (or none). */
export function sharedShape(ctx: ActionContext): EdgeShape | null {
  const shapes = new Set(selectedEdges(ctx).map(edgeShape));
  const [only] = shapes;
  return shapes.size === 1 && only !== undefined ? only : null;
}

function setLineType(ctx: ActionContext, shape: EdgeShape): void {
  const ids = selectedEdges(ctx).map((edge) => edge.id);
  if (ids.length === 0) return;
  oneStep(ctx.editor, () => {
    ctx.editor.setEdgeShape(ids, shape);
  });
  const ui = useUiStore.getState();
  ui.setLastLineShape(shape);
  ui.announce(
    ids.length === 1
      ? `Line type: ${lineLabel(shape)}`
      : `Line type: ${lineLabel(shape)} for ${String(ids.length)} connectors`,
  );
}

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
      const shape = sharedShape(ctx);
      return `Line type: ${shape === null ? 'mixed' : lineLabel(shape)}`;
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
        checked: (ctx) => sharedShape(ctx) === value,
        run: (ctx) => {
          setLineType(ctx, value);
        },
      })),
  },
];

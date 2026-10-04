import type { Edge } from '@sododeck/schema';
import { edgeLineStyle } from '@sododeck/model';
import { AlignHorizontalDistributeCenter, ArrowRightLeft, Cable, Spline, Type } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import { spreadEndsPlan, type SpreadPlan } from '../editing/spread-ends';
import { spreadTargets, spreadViewOf } from '../editing/spread-view';
import { DIRECTIONS, PROTOCOLS, protocolLabel } from '../fields/edge-choices';
import { applyLineType, LINE_TYPES, sharedLineShape } from '../fields/line-type';
import { oneStep } from '../fields/one-step';
import { applyLineStyle } from '../line-style/apply-line-style';
import { DASHES, WIDTHS, widthText } from '../line-style/line-style-options';
import { lineStyleView } from '../line-style/line-style-view';
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

/**
 * The spread-ends plan for the selected cards and groups (050 US7), from what the canvas draws.
 * Empty without a live canvas (nothing is drawn, so nothing can be spread).
 */
function spreadPlan(ctx: ActionContext): SpreadPlan {
  const nodes = ctx.canvas?.getNodes?.() ?? [];
  const edges = ctx.canvas?.getEdges?.() ?? [];
  return spreadEndsPlan(spreadViewOf(nodes, edges, ctx.deck.edges), spreadTargets(ctx.selection));
}

const count = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

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
    id: 'connection.lineStyle',
    label: 'Line style',
    icon: Spline,
    section: 'edit',
    field: 'lineStyle',
    where: { toolbar: ['connection', 'connections'] },
    run: () => {
      useUiStore.getState().openToolbarField('lineStyle');
    },
  },
  {
    id: 'connection.lineType',
    label: 'Line type',
    icon: Spline,
    section: 'edit',
    where: { menu: ['connection', 'connections'] },
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
  {
    id: 'connection.dash',
    label: 'Dash',
    section: 'edit',
    where: { menu: ['connection', 'connections'] },
    radio: true,
    children: () =>
      DASHES.map(({ value, label }) => ({
        id: `connection.dash.${value}`,
        label,
        section: 'edit',
        where: {},
        checked: (ctx) => {
          const dash = lineStyleView(selectedEdges(ctx)).dash.shared;
          return !dash.mixed && dash.value === value;
        },
        run: (ctx) => {
          applyLineStyle(
            ctx.editor,
            selectedEdges(ctx).map((edge) => edge.id),
            { dash: value },
            `Dash set to ${label}`,
          );
        },
      })),
  },
  {
    id: 'connection.weight',
    label: 'Weight',
    section: 'edit',
    where: { menu: ['connection', 'connections'] },
    radio: true,
    children: () =>
      WIDTHS.map((value) => ({
        id: `connection.weight.${String(value)}`,
        label: widthText(value),
        section: 'edit',
        where: {},
        checked: (ctx) => {
          const width = lineStyleView(selectedEdges(ctx)).width.shared;
          return !width.mixed && width.value === value;
        },
        run: (ctx) => {
          applyLineStyle(
            ctx.editor,
            selectedEdges(ctx).map((edge) => edge.id),
            { width: value },
            `Weight set to ${widthText(value)}`,
          );
        },
      })),
  },
  {
    id: 'connection.colour',
    label: 'Colour…',
    section: 'edit',
    where: { menu: ['connection', 'connections'] },
    run: () => {
      useUiStore.getState().openToolbarField('lineStyle');
    },
  },
  {
    id: 'connection.animate',
    label: 'Animate direction',
    section: 'edit',
    where: { menu: ['connection', 'connections'] },
    checked: (ctx) => {
      const edges = selectedEdges(ctx);
      return edges.length > 0 && edges.every((edge) => edgeLineStyle(edge).animated);
    },
    run: (ctx) => {
      const edges = selectedEdges(ctx);
      const next = !edges.every((edge) => edgeLineStyle(edge).animated);
      applyLineStyle(
        ctx.editor,
        edges.map((edge) => edge.id),
        { animated: next },
        `Animate direction, ${next ? 'on' : 'off'}`,
      );
    },
  },
];

/**
 * Spread ends evenly on the selected cards and groups (050 US7, R10). Listed after Align and
 * Arrange in `ACTIONS`, so it sits at the end of the arrange section.
 */
export const SPREAD_ENDS_ACTION: Action = {
  id: 'node.spreadEnds',
  label: 'Spread ends evenly',
  icon: AlignHorizontalDistributeCenter,
  section: 'arrange',
  where: {
    menu: ['component', 'components', 'group', 'mixed'],
    toolbar: ['component', 'components', 'group', 'mixed'],
  },
  disabledReason: (ctx) =>
    spreadPlan(ctx).patches.length === 0 ? 'No side has two or more connector ends' : null,
  run: (ctx) => {
    const plan = spreadPlan(ctx);
    if (plan.patches.length === 0) return;
    oneStep(ctx.editor, () => {
      for (const { edgeId, patch } of plan.patches) ctx.editor.setEdgeRoute(edgeId, patch);
    });
    useUiStore
      .getState()
      .announce(
        `Spread ${count(plan.ends, 'end', 'ends')} on ${count(plan.sides, 'side', 'sides')}`,
      );
  },
};

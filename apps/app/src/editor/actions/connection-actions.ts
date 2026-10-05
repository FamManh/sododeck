import type { Edge } from '@sododeck/schema';
import { edgeLineStyle } from '@sododeck/model';
import {
  AlignHorizontalDistributeCenter,
  ArrowRightLeft,
  Cable,
  Minus,
  Spline,
  Type,
} from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import { spreadEndsPlan, type SpreadPlan } from '../editing/spread-ends';
import { spreadTargets, spreadViewOf } from '../editing/spread-view';
import { DIRECTIONS, PROTOCOLS, protocolLabel } from '../fields/edge-choices';
import { applyLineType, LINE_TYPES, lineTypeLabel, sharedLineShape } from '../fields/line-type';
import { oneStep } from '../fields/one-step';
import { editableEdges, LOCKED_HINT, isEdgeLocked } from '../lock';
import { applyLineStyle } from '../line-style/apply-line-style';
import { DASHES, WIDTHS, widthText } from '../line-style/line-style-options';
import { lineStyleView } from '../line-style/line-style-view';
import { CARD_COLORS, colourName } from '../style/card-style';
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

/** What the toolbar says for a value several connectors may share: the value, or "Mixed". */
const sharedText = <T>(
  values: readonly T[],
  text: (value: T) => string,
): { text: string; value: T | null } => {
  const used = [...new Set(values)];
  const [only] = used;
  return used.length === 1 && only !== undefined
    ? { text: text(only), value: only }
    : { text: 'Mixed', value: null };
};

const directionOf = (edge: Edge) => edge.direction ?? 'forward';

const colourText = (colour: string | null): string =>
  colour === null ? 'none' : CARD_COLORS.includes(colour as never) ? colourName(colour) : colour;

/** The swatch a connector colour draws: a card colour's stroke, a deck hex as is. */
const colourSwatch = (colour: string): string =>
  CARD_COLORS.includes(colour as never) ? `var(--color-card-${colour}-stroke)` : colour;

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
    // Several connectors get the same popover from the Colour button (053 US4).
    where: { toolbar: ['connection'] },
    run: () => {
      useUiStore.getState().openToolbarField('lineStyle');
    },
  },
  {
    id: 'connection.direction',
    label: 'Arrow ends',
    toolbarLabel: (ctx) =>
      `Arrow ends: ${sharedText(selectedEdges(ctx).map(directionOf), (d) => DIRECTIONS.find((x) => x.value === d)?.label ?? d).text}`,
    icon: ArrowRightLeft,
    section: 'edit',
    where: { toolbar: ['connections'] },
    radio: true,
    children: () =>
      DIRECTIONS.map(({ value, label }) => ({
        id: `connection.direction.${value}`,
        label,
        section: 'edit',
        where: {},
        checked: (ctx) => sharedText(selectedEdges(ctx).map(directionOf), String).value === value,
        run: (ctx) => {
          // A locked connector is left out: its style is frozen with it.
          const editable = editableEdges(
            ctx.editor,
            selectedEdges(ctx).map((edge) => edge.id),
          );
          if (editable === null) return;
          oneStep(ctx.editor, () => {
            for (const id of editable.ids) ctx.editor.update('edges', id, { direction: value });
          });
          useUiStore
            .getState()
            .announce(
              `Arrow ends set to ${label}${editable.ids.length === 1 ? '' : ` for ${String(editable.ids.length)} connectors`}${editable.note}`,
            );
        },
      })),
  },
  {
    id: 'connection.lineType',
    label: 'Line type',
    toolbarLabel: (ctx) => {
      const shape = sharedLineShape(selectedEdges(ctx));
      return `Line type: ${shape === null ? 'Mixed' : lineTypeLabel(shape)}`;
    },
    icon: Spline,
    section: 'edit',
    where: { menu: ['connection', 'connections'], toolbar: ['connections'] },
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
    id: 'connection.colourField',
    label: 'Colour',
    toolbarLabel: (ctx) => {
      const shared = lineStyleView(selectedEdges(ctx)).color.shared;
      return `Colour: ${shared.mixed ? 'Mixed' : colourText(shared.value)}`;
    },
    swatch: (ctx) => {
      const shared = lineStyleView(selectedEdges(ctx)).color.shared;
      return shared.mixed || shared.value === null ? null : colourSwatch(shared.value);
    },
    section: 'edit',
    field: 'lineStyle',
    where: { toolbar: ['connections'] },
    run: () => {
      useUiStore.getState().openToolbarField('lineStyle');
    },
  },
  {
    id: 'connection.weight',
    label: 'Weight',
    toolbarLabel: (ctx) => {
      const shared = lineStyleView(selectedEdges(ctx)).width.shared;
      return `Weight: ${shared.mixed ? 'Mixed' : widthText(shared.value)}`;
    },
    icon: Minus,
    section: 'edit',
    where: { menu: ['connection', 'connections'], toolbar: ['connections'] },
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
  description: 'Space the connector ends evenly along each side of the selected cards',
  disabledReason: (ctx) =>
    spreadPlan(ctx).patches.length === 0 ? 'Needs a side with two or more connector ends' : null,
  run: (ctx) => {
    const plan = spreadPlan(ctx);
    // A locked connector keeps its anchors (the model refuses the write).
    const patches = plan.patches.filter(({ edgeId }) => !isEdgeLocked(ctx.deck, edgeId));
    if (patches.length === 0) {
      if (plan.patches.length > 0) useUiStore.getState().announce(LOCKED_HINT);
      return;
    }
    oneStep(ctx.editor, () => {
      for (const { edgeId, patch } of patches) ctx.editor.setEdgeRoute(edgeId, patch);
    });
    useUiStore
      .getState()
      .announce(
        `Spread ${count(plan.ends, 'end', 'ends')} on ${count(plan.sides, 'side', 'sides')}`,
      );
  },
};

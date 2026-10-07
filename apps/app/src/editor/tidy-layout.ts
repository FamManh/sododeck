/**
 * Tidy layout (011 US3, research R9): what to send to the ELK worker, how to read its answer, and
 * the hook that runs it. The worker is created on first use and terminated on Cancel, so `elkjs`
 * never enters the main bundle; the result is one `moveInView` + `setGroupFrames` batch (one undo
 * step, FR-033; frames since 016).
 */
import { fitGroupFrames, isLocked, type Point } from '@sododeck/model';
import type { Frame, Id, SododeckFile } from '@sododeck/schema';
import { useReactFlow } from '@xyflow/react';
import { useCallback, useEffect, useRef } from 'react';

import type { LayoutRequest, LayoutResult } from '../layout/elk-layout';
import { createLayoutClient, LayoutCancelled, type LayoutClient } from '../layout/layout-client';
import { useEditor } from '../model/use-editor';
import { isFlowMode, useUiStore } from '../state/ui-store';
import {
  cardSize,
  COLLAPSED_CARD_SIZE,
  COMPONENT_CARD_SIZE,
  displayPosition,
  GROUP_PADDING,
} from './canvas-geometry';
import { COLLAPSED_NODE_PREFIX } from './deck-to-flow';
import { effectiveLevel, levelForZoom, type Level } from './levels';
import { layoutEdgeOf } from './relationships/layout-edge';
import { tableContextOf } from './table-keys';
import { readViewState, useViewState } from './views/use-current-view';
import { scopeOf, visibleGraph, type VisibleGraph } from './visible-graph';

/** The Progress bar and Cancel show when a layout runs longer than this (FR-032). */
export const SLOW_LAYOUT_MS = 500;

/** Nearest group of `groupId`'s lineage (itself included when `self`) that the graph shows. */
function nearestShown(
  groupId: Id | undefined,
  parents: ReadonlyMap<Id, Id | undefined>,
  shown: ReadonlySet<Id>,
  self: boolean,
): Id | undefined {
  const seen = new Set<Id>();
  let current = self ? groupId : groupId === undefined ? undefined : parents.get(groupId);
  while (current !== undefined && !seen.has(current)) {
    if (shown.has(current)) return current;
    seen.add(current);
    current = parents.get(current);
  }
  return undefined;
}

/**
 * The layout request for what the canvas shows (FR-030, FR-031): visible components of the
 * current scope (hidden ones are not in the view deck), each collapsed group as one card, the
 * shown groups as compounds, plain and merged connections, and the pinned components at the
 * position this view draws them. `deck` is the view deck (`ViewState.deck`).
 */
export function buildLayoutRequest(
  deck: SododeckFile,
  graph: VisibleGraph,
  pinned: ReadonlySet<Id>,
  level: Level,
): LayoutRequest {
  const parents = new Map(deck.groups.map((g) => [g.id, g.parent]));
  const shown = new Set(graph.groups);
  const indexOf = new Map(deck.nodes.map((n, i) => [n.id, i]));
  const nodesById = new Map(deck.nodes.map((n) => [n.id, n]));

  const request: LayoutRequest = { nodes: [], groups: [], edges: [], pinned: {} };
  for (const card of graph.cards) {
    const parent = nearestShown(card.groupId, parents, shown, false);
    request.nodes.push({
      id: `${COLLAPSED_NODE_PREFIX}${card.groupId}`,
      ...COLLAPSED_CARD_SIZE,
      ...(parent === undefined ? {} : { parent }),
    });
  }
  for (const id of graph.nodes) {
    const node = nodesById.get(id);
    if (node === undefined) continue;
    const parent = nearestShown(node.group, parents, shown, true);
    request.nodes.push({
      id,
      ...cardSize(node, level),
      ...(parent === undefined ? {} : { parent }),
    });
    if (pinned.has(id)) request.pinned[id] = displayPosition(node, indexOf.get(id) ?? 0);
  }
  for (const groupId of graph.groups) {
    const parent = nearestShown(groupId, parents, shown, false);
    request.groups.push({ id: groupId, ...(parent === undefined ? {} : { parent }) });
  }
  const edgesById = new Map(deck.edges.map((e) => [e.id, e]));
  // A group end is drawn on its frame, `group:<id>`: the id ELK gives the group's compound (050).
  const drawnAs = (id: string) => graph.representative.get(id) ?? id;
  const tables = tableContextOf(deck);
  for (const id of graph.edges) {
    const edge = edgesById.get(id);
    if (edge !== undefined)
      request.edges.push(
        layoutEdgeOf(edge, nodesById, tables, drawnAs(edge.from), drawnAs(edge.to)),
      );
  }
  for (const merged of graph.merged) {
    request.edges.push({ id: merged.id, source: merged.a, target: merged.b });
  }
  return request;
}

/**
 * Positions to write from a layout result: components directly, and the members of a collapsed
 * card moved by the card's offset so they keep their arrangement inside. Pinned components are
 * never written (SC-001).
 */
export function expandResult(
  result: LayoutResult,
  deck: SododeckFile,
  graph: VisibleGraph,
  pinned: ReadonlySet<Id>,
): Record<Id, Point> {
  const out: Record<Id, Point> = {};
  const cards = new Map(graph.cards.map((c) => [`${COLLAPSED_NODE_PREFIX}${c.groupId}`, c]));
  const deltas = new Map<string, Point>();
  for (const [id, point] of Object.entries(result)) {
    const card = cards.get(id);
    if (card !== undefined) {
      deltas.set(id, { x: point.x - card.rect.x, y: point.y - card.rect.y });
    } else if (!pinned.has(id)) {
      out[id] = { x: Math.round(point.x), y: Math.round(point.y) };
    }
  }
  if (deltas.size > 0) {
    deck.nodes.forEach((node, index) => {
      const representative = graph.representative.get(node.id);
      const delta = representative === undefined ? undefined : deltas.get(representative);
      if (delta === undefined || pinned.has(node.id)) return;
      const at = displayPosition(node, index);
      out[node.id] = { x: Math.round(at.x + delta.x), y: Math.round(at.y + delta.y) };
    });
  }
  return out;
}

/**
 * New frames for the groups a layout moved (016 FR-045): every group holding a moved component,
 * directly or through nested groups, refitted inner-first around the new positions (full-detail
 * card size plus `GROUP_PADDING`, like frames fitted on open). Other groups keep their frames.
 */
export function laidOutFrames(
  deck: SododeckFile,
  positions: Readonly<Record<Id, Point>>,
): Record<Id, Frame> {
  const parents = new Map(deck.groups.map((g) => [g.id, g.parent]));
  const affected = new Set<Id>();
  for (const node of deck.nodes) {
    if (positions[node.id] === undefined) continue;
    let group = node.group;
    while (group !== undefined && !affected.has(group)) {
      affected.add(group);
      group = parents.get(group);
    }
  }
  if (affected.size === 0) return {};
  const moved: SododeckFile = {
    ...deck,
    nodes: deck.nodes.map((node, index) => ({
      ...node,
      position: positions[node.id] ?? displayPosition(node, index),
    })),
    groups: deck.groups.map((group) => {
      if (!affected.has(group.id)) return group;
      const { position: _position, size: _size, ...rest } = group;
      return rest;
    }),
    views: [],
  };
  const fitted = fitGroupFrames(moved, {
    cardSize: COMPONENT_CARD_SIZE,
    sizeOf: (node) => cardSize(node, 'component'),
    padding: GROUP_PADDING,
  });
  return Object.fromEntries([...fitted].filter(([id]) => affected.has(id)));
}

/** How many of `positions` differ from where `deck` (the view deck) draws them. */
export function movedCount(positions: Readonly<Record<Id, Point>>, deck: SododeckFile): number {
  let moved = 0;
  deck.nodes.forEach((node, index) => {
    const next = positions[node.id];
    if (next === undefined) return;
    const at = displayPosition(node, index);
    if (at.x !== next.x || at.y !== next.y) moved++;
  });
  return moved;
}

/** Pinned ids plus every locked card: Tidy layout leaves both in place. */
function withLocked(pinned: ReadonlySet<Id>, deck: Pick<SododeckFile, 'nodes'>): ReadonlySet<Id> {
  const locked = deck.nodes.filter(isLocked).map((node) => node.id);
  return locked.length === 0 ? pinned : new Set([...pinned, ...locked]);
}

export type TidyBlock =
  'Not available while a flow is open' | 'Nothing to arrange' | 'All components are pinned';

/** Why Tidy layout is disabled right now (FR-035), or null when it can run. */
export function useTidyBlock(): TidyBlock | null {
  const state = useViewState();
  const drill = useUiStore((s) => s.drill);
  const flow = useUiStore((s) => s.flowSession !== null || isFlowMode(s));
  if (flow) return 'Not available while a flow is open';
  const graph = visibleGraph(state.deck, scopeOf(drill), state.collapsed);
  if (graph.nodes.length + graph.cards.length === 0) return 'Nothing to arrange';
  if (graph.cards.length === 0 && graph.nodes.every((id) => state.render.pinned.has(id))) {
    return 'All components are pinned';
  }
  return null;
}

/** One client per page, created on first use (keeps `elkjs` out of start-up). */
let sharedClient: LayoutClient | null = null;
function layoutClient(): LayoutClient {
  sharedClient ??= createLayoutClient();
  return sharedClient;
}

/**
 * Runs Tidy layout on the current view (or the drilled scope) off the main thread (FR-032):
 * `running`, then `slow` after 500 ms (progress bar + Cancel); the result is applied to the
 * components that still exist and are still unpinned, as one undo step; the canvas then fits it.
 */
export function useTidyLayout(): { run: () => Promise<void>; cancel: () => void } {
  const editor = useEditor();
  const { fitView, getZoom } = useReactFlow();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clearTimer, []);

  const run = useCallback(async () => {
    const ui = useUiStore.getState();
    if (ui.layoutRun.status !== 'idle') return;
    const start = readViewState(editor.doc);
    const scope = scopeOf(ui.drill);
    const graph = visibleGraph(start.deck, scope, start.collapsed);
    const level = effectiveLevel(levelForZoom(getZoom()), scope);
    // Locked cards stay where they are, like pinned ones (043 FR-023).
    const held = withLocked(start.render.pinned, start.deck);
    const request = buildLayoutRequest(start.deck, graph, held, level);
    const viewId = start.view.id;
    ui.setLayoutRun({ status: 'running', viewId });
    ui.announce('Tidying layout');
    timer.current = setTimeout(() => {
      if (useUiStore.getState().layoutRun.status === 'running') {
        useUiStore.getState().setLayoutRun({ status: 'slow', viewId });
      }
    }, SLOW_LAYOUT_MS);
    try {
      const result = await layoutClient().layout(request);
      // Edits may have landed meanwhile (US3 #7): skip deleted and newly pinned components.
      const now = readViewState(editor.doc);
      const view = now.views.find((v) => v.id === viewId);
      if (view === undefined) {
        useUiStore.getState().announce('Layout not applied: the view was deleted');
        return;
      }
      const pinnedNow = withLocked(new Set(view.pinned ?? []), now.deck);
      const positions = expandResult(result, start.deck, graph, held);
      const existing = new Set(now.deck.nodes.map((n) => n.id));
      for (const id of Object.keys(positions)) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- plain record
        if (!existing.has(id) || pinnedNow.has(id)) delete positions[id];
      }
      const moved = movedCount(positions, start.deck);
      if (Object.keys(positions).length > 0) {
        // Frames follow the layout in the same undo step (016 FR-045).
        const frames = laidOutFrames(start.deck, positions);
        editor.batch(() => {
          editor.moveInView(viewId, positions);
          editor.setGroupFrames(viewId, frames);
        });
      }
      if (now.view.id === viewId) {
        requestAnimationFrame(() => {
          void fitView({ padding: 0.2, maxZoom: 1.3, minZoom: 0.4 });
        });
      }
      useUiStore
        .getState()
        .announce(
          `Layout tidied, ${String(moved)} ${moved === 1 ? 'component' : 'components'} moved`,
        );
    } catch (error) {
      if (!(error instanceof LayoutCancelled)) {
        useUiStore.getState().announce('Layout failed; nothing was moved');
      }
    } finally {
      clearTimer();
      useUiStore.getState().setLayoutRun({ status: 'idle' });
    }
  }, [editor, fitView, getZoom]);

  const cancel = useCallback(() => {
    if (useUiStore.getState().layoutRun.status === 'idle') return;
    layoutClient().cancel();
    useUiStore.getState().announce('Layout cancelled');
  }, []);

  return { run, cancel };
}

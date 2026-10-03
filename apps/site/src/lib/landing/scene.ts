/**
 * Lays out a deck scene (cards, shapes, proxies, connectors) in world coordinates: the pure part
 * of the landing page canvas visuals.
 */
import type { SceneEdge, SceneNode } from './checkout-deck';
import { anchorPoint, cardHeight, curve, DECK, type Box, type Point, type Side } from './geometry';

export function nodeBox(node: SceneNode): Box {
  switch (node.kind) {
    case 'shape':
      return { x: node.x, y: node.y, w: node.shape.w, h: node.shape.h, anchor: node.shape.h / 2 };
    case 'proxy':
      return {
        x: node.x,
        y: node.y,
        w: node.proxy.w,
        h: DECK.proxyHeight,
        anchor: DECK.proxyAnchor,
      };
    case 'card': {
      const { card } = node;
      return {
        x: node.x,
        y: node.y,
        w: DECK.width,
        h: cardHeight({
          title: card.title,
          ...(card.description === undefined ? {} : { description: card.description }),
          fields: card.fields?.length ?? 0,
          tags: card.tags?.length ?? 0,
          inside: card.inside !== undefined,
        }),
      };
    }
  }
}

export interface EdgeLayout {
  edge: SceneEdge;
  d: string;
  start: Point;
  end: Point;
  endSide: Side;
  /** Where the label sits (the path point at `labelAt`). */
  label: Point;
  at: (f: number) => Point;
}

export interface SceneLayout {
  boxes: ReadonlyMap<string, Box>;
  edges: readonly EdgeLayout[];
}

/** Boxes for every node and the curve of every connector whose two ends are in the scene. */
export function layoutScene(nodes: readonly SceneNode[], edges: readonly SceneEdge[]): SceneLayout {
  const boxes = new Map<string, Box>();
  for (const node of nodes) boxes.set(node.key, nodeBox(node));
  const laid: EdgeLayout[] = [];
  for (const edge of edges) {
    const a = boxes.get(edge.from);
    const b = boxes.get(edge.to);
    if (a === undefined || b === undefined) continue;
    const start = anchorPoint(a, edge.fromSide, edge.fromAt);
    const end = anchorPoint(b, edge.toSide, edge.toAt);
    const geometry = curve(start, edge.fromSide, end, edge.toSide);
    laid.push({
      edge,
      d: geometry.d,
      start,
      end,
      endSide: edge.toSide,
      label: geometry.at(edge.labelAt ?? 0.5),
      at: geometry.at,
    });
  }
  return { boxes, edges: laid };
}

/** A connector's look in the Deck direction. */
export type EdgeState = 'default' | 'done' | 'current' | 'dim' | 'highlight' | 'error';

export interface EdgeStroke {
  colour: string;
  width: number;
  dash?: string;
  opacity: number;
}

export function edgeStroke(state: EdgeState, writes: boolean): EdgeStroke {
  const base: EdgeStroke = {
    colour: 'var(--sd-deck-edge)',
    width: DECK.edgeWidth,
    ...(writes ? { dash: '12 3' } : {}),
    opacity: 1,
  };
  switch (state) {
    case 'default':
      return base;
    case 'done':
      return { ...base, colour: 'var(--sd-text-secondary)', width: DECK.edgeWidth + 0.5 };
    case 'current':
      // The current step is always solid, even over a dashed "writes" connector.
      return { colour: 'var(--sd-primary)', width: DECK.edgeWidth + 1.25, opacity: 1 };
    case 'dim':
      return { ...base, opacity: 0.2 };
    case 'highlight':
      return { ...base, colour: 'var(--sd-ink)', width: DECK.edgeWidth + 0.75 };
    case 'error':
      return {
        ...base,
        colour: 'var(--sd-clay-ink)',
        width: DECK.edgeWidth + 0.5,
        dash: '7 4',
      };
  }
}

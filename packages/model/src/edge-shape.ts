/**
 * Effective line type of a connector (029, data-model.md). Pure and shared by the app, so the
 * stored `style.shape` and the pre-029 meaning of a route `offset` (an elbow) agree everywhere.
 */
import type { ColorRef, Edge, EdgeShape, EdgeStyle } from '@sododeck/schema';

export type { EdgeShape };

/** The keys that decide a connector's line type. */
export type ShapedEdge = Pick<
  Edge,
  'route' | 'style' | 'cardinality' | 'fromColumns' | 'toColumns'
>;

/**
 * The stored shape; else `elbow` when a route offset exists (pre-029 files) or for a table
 * relationship (it reads row to row, so it runs in straight legs); else `curved`.
 */
export function edgeShape(edge: ShapedEdge): EdgeShape {
  if (edge.style?.shape !== undefined) return edge.style.shape;
  const relationship =
    edge.cardinality !== undefined ||
    (edge.fromColumns?.length ?? 0) > 0 ||
    (edge.toColumns?.length ?? 0) > 0;
  return edge.route?.offset !== undefined || relationship ? 'elbow' : 'curved';
}

export type Dash = NonNullable<EdgeStyle['dash']>;
export type Width = NonNullable<EdgeStyle['width']>;

/** The effective look of a connector line: stored values with the defaults applied. */
export interface EdgeLineStyle {
  shape: EdgeShape;
  dash: Dash;
  width: Width;
  color: ColorRef | null;
  animated: boolean;
}

/** Defaults: solid, 2 px (today's line since 029), no colour (the default grey), not animated. */
export function edgeLineStyle(edge: ShapedEdge): EdgeLineStyle {
  const style = edge.style;
  return {
    shape: edgeShape(edge),
    dash: style?.dash ?? 'solid',
    width: style?.width ?? 2,
    color: style?.color ?? null,
    animated: style?.animated ?? false,
  };
}

/**
 * Effective line type of a connector (029, data-model.md). Pure and shared by the app, so the
 * stored `style.shape` and the pre-029 meaning of a route `offset` (an elbow) agree everywhere.
 */
import type { Edge, EdgeShape } from '@sododeck/schema';

export type { EdgeShape };

/** The stored shape; else `elbow` when a route offset exists (pre-029 files); else `curved`. */
export function edgeShape(edge: Pick<Edge, 'route' | 'style'>): EdgeShape {
  return edge.style?.shape ?? (edge.route?.offset !== undefined ? 'elbow' : 'curved');
}

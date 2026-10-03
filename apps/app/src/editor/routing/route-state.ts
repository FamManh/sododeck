/** What a stored route holds beyond pinned sides (022): bends, anchor positions or a 017 offset. */
import type { Edge } from '@sododeck/schema';

export function hasCustomRoute(edge: Pick<Edge, 'route'>): boolean {
  const route = edge.route;
  return (
    route !== undefined &&
    (route.offset !== undefined ||
      route.fromAt !== undefined ||
      route.toAt !== undefined ||
      (route.waypoints?.length ?? 0) > 0)
  );
}

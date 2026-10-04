/**
 * The connector as it would be drawn with one end being dragged (050 R3, FR-013): the dragged end
 * swaps to the live target's box and outline (or the free point off every target), its side and
 * position become the live ones (or are dropped for "automatic"), and the sides are resolved the
 * way `deck-to-flow` resolves them. Pure; `DeckEdge` feeds the result to `connectorPath`, so the
 * preview is drawn in the connector's own type and ends exactly where the end will land.
 */
import type { Geometry } from '@sododeck/model';
import type { EdgeRoute, Id } from '@sododeck/schema';

import type { EndpointPreview } from '../../state/ui-store';
import { autoSides, cardCentre, decodeWaypoints } from './connector-geometry';
import { resolveSides, type Box, type ResolvedSides } from './route-path';

export interface DrawnEnds {
  fromBox: Box;
  toBox: Box;
  sides: ResolvedSides;
  route: EdgeRoute | undefined;
  fromGeometry?: Geometry | undefined;
  toGeometry?: Geometry | undefined;
}

export function withEndPreview(
  base: DrawnEnds,
  preview: EndpointPreview,
  ids: { source: Id; target: Id },
): DrawnEnds {
  const source = preview.end === 'source';
  const box = preview.box ?? { ...preview.point, width: 0, height: 0 };
  const geometry = preview.box === null ? undefined : preview.geometry;
  const pinned = preview.box !== null && !preview.automatic;
  const retargeted = preview.targetId !== (source ? ids.source : ids.target);
  const route: EdgeRoute = { ...base.route };
  if (source) {
    delete route.fromSide;
    delete route.fromAt;
    if (pinned) Object.assign(route, { fromSide: preview.side, fromAt: preview.at });
  } else {
    delete route.toSide;
    delete route.toAt;
    if (pinned) Object.assign(route, { toSide: preview.side, toAt: preview.at });
  }
  // A new target drops 017's middle-segment offset, as the write on release does.
  if (retargeted) delete route.offset;
  const fromBox = source ? box : base.fromBox;
  const toBox = source ? base.toBox : box;
  const waypoints = route.waypoints;
  const sides =
    waypoints === undefined
      ? resolveSides(fromBox, toBox, route)
      : autoSides(
          fromBox,
          toBox,
          decodeWaypoints(waypoints, cardCentre(fromBox), cardCentre(toBox)),
          route,
        );
  return {
    fromBox,
    toBox,
    sides,
    route: Object.keys(route).length === 0 ? undefined : route,
    fromGeometry: source ? geometry : base.fromGeometry,
    toGeometry: source ? base.toGeometry : geometry,
  };
}

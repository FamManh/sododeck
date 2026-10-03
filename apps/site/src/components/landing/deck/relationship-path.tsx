import type { RelationshipLayout } from '../../../lib/landing/schema';
import { C } from '../../../lib/landing/tokens';

/** A relationship connector with a crow's foot at each end. */
export function RelationshipPath({ layout }: { layout: RelationshipLayout }) {
  const colour = C.edge;
  return (
    <g>
      <path d={layout.d} fill="none" stroke={colour} strokeWidth={2} strokeLinecap="round" />
      {layout.ends.map((end, i) => (
        // Two ends per relationship, always in the same order.
        <g key={i}>
          {end.paths.map((d) => (
            <path
              key={d}
              d={d}
              stroke={colour}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {end.rings.map((ring) => (
            <circle
              key={`${String(ring.x)},${String(ring.y)}`}
              cx={ring.x}
              cy={ring.y}
              r={4}
              fill={C.canvas}
              stroke={colour}
              strokeWidth={2}
            />
          ))}
        </g>
      ))}
    </g>
  );
}

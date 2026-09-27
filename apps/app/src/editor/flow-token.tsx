import { useReducedMotion } from '@sododeck/ui/hooks/use-reduced-motion';
import { resolveMotion } from '@sododeck/ui/lib/motion';

interface FlowTokenProps {
  /** The edge path the token travels. */
  path: string;
  /** Where the static token sits under reduced motion: the label point (the edge midpoint). */
  x: number;
  y: number;
  speed: 1 | 2;
}

/**
 * The animated token on the current step's edge (007 FR-006, research R5): a primary dot with a
 * surface stroke and a soft halo, looping along the edge with SVG `<animateMotion>` (no JS per
 * frame). Static at the midpoint under reduced motion.
 */
export function FlowToken({ path, x, y, speed }: FlowTokenProps) {
  const reduced = useReducedMotion();
  const { tokenLoopMs } = resolveMotion(reduced);
  const animated = tokenLoopMs > 0;
  return (
    <g
      data-testid="flow-token"
      aria-hidden
      pointerEvents="none"
      {...(animated ? {} : { transform: `translate(${String(x)} ${String(y)})` })}
    >
      <circle r={10} fill="var(--color-primary)" fillOpacity={0.2} />
      <circle r={5} fill="var(--color-primary)" stroke="var(--color-surface)" strokeWidth={2} />
      {animated && (
        <animateMotion
          path={path}
          dur={`${String(tokenLoopMs / speed)}ms`}
          repeatCount="indefinite"
        />
      )}
    </g>
  );
}

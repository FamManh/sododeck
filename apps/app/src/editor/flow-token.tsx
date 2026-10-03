import { useReducedMotion } from '@sododeck/ui/hooks/use-reduced-motion';
import { resolveMotion } from '@sododeck/ui/lib/motion';

interface FlowTokenProps {
  /** The edge path the token travels. */
  path: string;
  /** Where the static token sits under reduced motion: the label point (the edge midpoint). */
  x: number;
  y: number;
  speed: 1 | 2;
  /** The current step's number, printed on the disc. */
  number: string;
}

// The 24px disc (--sd-flow-token), its 2.5px Surface ring and 3px Orange Ink lip, in SVG units.
const DISC_R = 12;
const RING = 2.5;
const LIP = 3;

/**
 * The numbered token on the current step's edge (035 FR-008, 007 FR-006): a Deck Orange disc with
 * the step number, a Surface ring and an Orange Ink lip, looping along the edge with SVG
 * `<animateMotion>` (no JS per frame). Static at the midpoint under reduced motion.
 */
export function FlowToken({ path, x, y, speed, number }: FlowTokenProps) {
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
      <circle cy={LIP} r={DISC_R + RING} fill="var(--color-deck-orange-ink)" />
      <circle r={DISC_R + RING} fill="var(--color-surface)" />
      <circle r={DISC_R} fill="var(--color-deck-orange)" />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={number.length > 2 ? 9 : 11.5}
        fontWeight={700}
        fill="var(--color-on-primary)"
        className="font-mono"
      >
        {number}
      </text>
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

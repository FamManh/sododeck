import { cn } from '@sododeck/ui/lib/utils';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { memo } from 'react';

import type { DeckFlowEdge } from './deck-to-flow';

const DOT_RADIUS = 3;

/**
 * Connection (DESIGN.md: orthogonal routing, 8px corners, 3px end dot; designs 11, 12, 57).
 * Direction is shown by the dots: at the target (forward), at both ends (both), none (none).
 */
export const DeckEdge = memo(function DeckEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
  interactionWidth,
}: EdgeProps<DeckFlowEdge>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });
  const direction = data?.direction ?? 'forward';
  const stroke = selected ? 'var(--color-primary)' : 'var(--color-edge)';
  const dots = [
    ...(direction === 'both' ? [{ x: sourceX, y: sourceY }] : []),
    ...(direction === 'none' ? [] : [{ x: targetX, y: targetY }]),
  ];

  return (
    <>
      {data?.focused && (
        <path
          d={path}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={6}
          strokeDasharray="4 3"
          strokeOpacity={0.6}
          data-testid="edge-focus-ring"
        />
      )}
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={interactionWidth ?? 12}
        style={{ stroke, strokeWidth: selected ? 2.5 : 1.5 }}
      />
      {dots.map((dot) => (
        <circle
          key={`${String(dot.x)},${String(dot.y)}`}
          data-testid="edge-dot"
          cx={dot.x}
          cy={dot.y}
          r={DOT_RADIUS}
          fill={stroke}
        />
      ))}
      {(data?.showLabel === true || selected) && (
        <EdgeLabelRenderer>
          {/* Anchor for the edge popover, at the label point (edge-popover.tsx). */}
          <div
            data-edge-anchor={id}
            className="pointer-events-none absolute size-px"
            style={{ transform: `translate(${String(labelX)}px, ${String(labelY)}px)` }}
          />
          {data?.showLabel === true && data.label && (
            <span
              data-testid="edge-label"
              className={cn(
                'nodrag nopan pointer-events-auto absolute rounded-full border bg-surface px-2 py-0.5 font-mono text-edge-label whitespace-nowrap',
                selected ? 'border-primary text-primary-ink' : 'border-border text-ink-secondary',
              )}
              style={{
                transform: `translate(-50%, -50%) translate(${String(labelX)}px, ${String(labelY)}px)`,
              }}
            >
              {data.label}
            </span>
          )}
        </EdgeLabelRenderer>
      )}
    </>
  );
});

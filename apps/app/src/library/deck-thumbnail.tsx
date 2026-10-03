import type { DeckThumb } from '../storage/library-db';

/** Soft type tints (DESIGN.md "Type & Semantic Tints"), lighter than on the canvas. */
const TYPE_FILL: Readonly<Record<string, string>> = {
  client: 'fill-surface-2',
  gateway: 'fill-surface-3',
  service: 'fill-primary-soft',
  queue: 'fill-amber-soft',
  database: 'fill-blue-soft',
  external: 'fill-clay-soft',
  component: 'fill-surface-2',
  task: 'fill-success-soft',
  decision: 'fill-amber-soft',
  document: 'fill-blue-soft',
  warehouse: 'fill-success-soft',
  'truck-route': 'fill-amber-soft',
  issue: 'fill-clay-soft',
};

/** A type this version has no tint for (an unknown id) draws neutral. */
const FALLBACK_FILL = 'fill-surface-2';

const PAD = 60;

/**
 * The card preview (research R10): components and groups drawn from the cached summary on the
 * dotted canvas background. An empty deck shows the background only.
 */
export function DeckThumbnail({ name, thumb }: { name: string; thumb: DeckThumb | null }) {
  return (
    <div className="h-37 overflow-hidden bg-canvas bg-[radial-gradient(var(--color-dot)_1px,transparent_1px)] bg-size-[22px_22px]">
      {thumb && (
        <svg
          role="img"
          aria-label={`${name} preview`}
          viewBox={`${String(-PAD)} ${String(-PAD)} ${String(thumb.w + 2 * PAD)} ${String(thumb.h + 2 * PAD)}`}
          preserveAspectRatio="xMidYMid meet"
          className="size-full p-4"
        >
          {thumb.groups.map(([x, y, w, h], i) => (
            <rect
              key={`g${String(i)}`}
              x={x}
              y={y}
              width={w}
              height={h}
              rx={Math.min(24, w / 8)}
              className="fill-none stroke-border"
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {thumb.nodes.map(([x, y, type, w, h], i) => {
            const width = w ?? thumb.node[0];
            const height = h ?? thumb.node[1];
            return (
              <rect
                key={`n${String(i)}`}
                x={x}
                y={y}
                width={width}
                height={height}
                rx={Math.min(height / 4, 16)}
                className={`${(Object.hasOwn(TYPE_FILL, type) ? TYPE_FILL[type] : undefined) ?? FALLBACK_FILL} stroke-border`}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}

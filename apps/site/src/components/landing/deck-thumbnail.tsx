import { ALL_EDGES, ALL_FRAMES, ALL_NODES, WORLD } from '../../lib/landing/checkout-deck';
import { C } from '../../lib/landing/tokens';
import { DeckScene } from './deck/deck-scene';
import { Viewport } from './deck/viewport';

interface DeckThumbnailProps {
  title: string;
  meta: string;
  /** World zoom of the preview: the deck fits a card about 220px wide. */
  scale: number;
}

/** A deck in the library (005): its preview, name and last edit. */
export function DeckThumbnail({ title, meta, scale }: DeckThumbnailProps) {
  return (
    <div
      className="w-full tab:min-w-0 tab:flex-1"
      style={{
        boxSizing: 'border-box',
        background: C.surface,
        border: `1.5px solid ${C.borderStrong}`,
        borderRadius: 16,
        boxShadow: `0 3px 0 0 ${C.borderStrong}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Viewport
        width="100%"
        height={140}
        scale={scale}
        offsetX={`calc(50% - ${String(Math.round((WORLD.w * scale) / 2))}px)`}
        offsetY={(140 - WORLD.h * scale) / 2}
        worldWidth={WORLD.w}
        worldHeight={WORLD.h}
        radius={0}
        border={false}
      >
        <DeckScene
          nodes={ALL_NODES}
          edges={ALL_EDGES}
          frames={ALL_FRAMES}
          width={WORLD.w}
          height={WORLD.h}
          zoom="container"
          labels={false}
        />
      </Viewport>
      <div
        style={{
          padding: '12px 14px',
          borderTop: `1px solid ${C.hairline}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{title}</span>
        <span style={{ fontSize: 12, color: C.muted }}>{meta}</span>
      </div>
    </div>
  );
}

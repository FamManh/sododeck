import type { SododeckFile } from '@sododeck/schema';
import { ViewportPortal } from '@xyflow/react';

import { useUiStore } from '../state/ui-store';
import { nodeSize, selectionFrame } from './canvas-geometry';
import type { Level } from './levels';

/** Frame around a multi-selection (design 58; 1 px solid since 018), in flow coordinates. */
export function SelectionFrame({ deck, level }: { deck: SododeckFile; level: Level }) {
  const selected = useUiStore((s) => s.selection.nodes);
  const frame = selectionFrame(deck, selected, nodeSize(level));
  if (!frame) return null;
  return (
    <ViewportPortal>
      <div
        data-testid="selection-frame"
        aria-hidden
        className="pointer-events-none absolute rounded-node border border-primary"
        style={{
          transform: `translate(${String(frame.x)}px, ${String(frame.y)}px)`,
          width: frame.width,
          height: frame.height,
        }}
      />
    </ViewportPortal>
  );
}

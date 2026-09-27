import type { SododeckFile } from '@sododeck/schema';
import { ViewportPortal } from '@xyflow/react';

import { useUiStore } from '../state/ui-store';
import { selectionFrame } from './canvas-geometry';

/** Dashed frame around a multi-selection (design 58), drawn in flow coordinates. */
export function SelectionFrame({ deck }: { deck: SododeckFile }) {
  const selected = useUiStore((s) => s.selection.nodes);
  const frame = selectionFrame(deck, selected);
  if (!frame) return null;
  return (
    <ViewportPortal>
      <div
        data-testid="selection-frame"
        aria-hidden
        className="pointer-events-none absolute rounded-node border border-dashed border-primary"
        style={{
          transform: `translate(${String(frame.x)}px, ${String(frame.y)}px)`,
          width: frame.width,
          height: frame.height,
        }}
      />
    </ViewportPortal>
  );
}

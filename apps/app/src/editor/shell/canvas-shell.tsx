import type { ReactNode } from 'react';

import { GestureHint } from '../editing/gesture-hint';

/**
 * The canvas-first layout (018, ADR 0014): the canvas fills the whole screen and never shares its
 * box, so opening chrome never resizes it (FR-002). All chrome sits in one overlay layer that
 * lets pointer events through (`pointer-events: none`); each island, flyout, drawer and overlay
 * opts back in, so drags that start on the canvas keep working around them (FR-004).
 */
export function CanvasShell({
  canvas,
  children,
}: {
  canvas: ReactNode;
  /** Islands, flyouts, the drawer and overlays; each positions itself inside the layer. */
  children?: ReactNode;
}) {
  return (
    <div className="relative h-dvh overflow-hidden bg-canvas">
      <div data-testid="shell-canvas" className="absolute inset-0">
        {canvas}
      </div>
      <div data-testid="shell-overlay" className="pointer-events-none absolute inset-0 z-10">
        {children}
        <GestureHint />
      </div>
    </div>
  );
}

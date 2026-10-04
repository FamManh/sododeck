/**
 * The guides' safety net (050 R9). Every gesture clears its own guides and previews, but React
 * Flow can swallow an end (a node unmounts mid-resize, a release outside the window). After any
 * window `pointerup`, `pointercancel`, `blur` or `visibilitychange`, once the event has run its
 * course (a microtask), this clears whatever a gesture left in the UI store, provided no gesture
 * is registered (`hasActiveGesture()`). A running gesture is never touched.
 */
import { useEffect } from 'react';

import { useUiStore } from '../../state/ui-store';
import { hasActiveGesture } from './drag-session';

/** Clears gesture leftovers. A pan is left alone: React Flow ends it on its own move end. */
export function clearGestureLeftovers(): void {
  const ui = useUiStore.getState();
  ui.setGuides([]);
  if (ui.bendPreview !== null) ui.setBendPreview(null);
  if (ui.labelPreview !== null) ui.setLabelPreview(null);
  if (ui.endpointPreview !== null) ui.setEndpointPreview(null);
  if (ui.lineStylePreview !== null) ui.setLineStylePreview(null);
  if (ui.connectorReadout !== null) ui.setConnectorReadout(null);
  if (ui.resizeReadout !== null) ui.setResizeReadout(null);
  if (ui.dragReadout !== null) ui.setDragReadout(null);
  if (ui.dropTarget !== null) ui.setDropTarget(null);
  if (ui.canvasGesture !== null && ui.canvasGesture !== 'pan') ui.setCanvasGesture(null);
}

export function useGuideSafetyNet(): void {
  useEffect(() => {
    let queued = false;
    const check = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        if (!hasActiveGesture()) clearGestureLeftovers();
      });
    };
    // Element blurs reach a capture listener too; only the window losing focus counts.
    const onBlur = (event: Event) => {
      if (!(event.target instanceof Node)) check();
    };
    window.addEventListener('pointerup', check);
    window.addEventListener('pointercancel', check);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.removeEventListener('pointerup', check);
      window.removeEventListener('pointercancel', check);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
}

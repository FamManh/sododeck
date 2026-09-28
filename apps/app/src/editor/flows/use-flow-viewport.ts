import type { SododeckFile } from '@sododeck/schema';
import { useReducedMotion } from '@sododeck/ui/hooks/use-reduced-motion';
import { resolveMotion } from '@sododeck/ui/lib/motion';
import { useReactFlow } from '@xyflow/react';
import { useEffect, useEffectEvent, useRef } from 'react';

import { boundsOf, rectInView } from '../canvas-geometry';
import { fitRectInFreeArea } from '../shell/shell-geometry';
import { currentInsets } from '../shell/shell-insets';
import { MAX_ZOOM, MIN_ZOOM } from '../zoom-limits';
import type { Playback } from './flow-mode';

/**
 * Keeps the open flow in view (007 FR-004, FR-011): fits the played path when a flow opens (into
 * the canvas area the floating chrome leaves free, 018), and
 * pans (keeping the zoom) to the current step only when it is outside the viewport. Waits one
 * frame so React Flow has measured the canvas.
 */
export function useFlowViewport(
  deck: SododeckFile,
  playback: Playback | null,
  wrapper: React.RefObject<HTMLElement | null>,
): void {
  const { fitBounds, setCenter, getViewport, setViewport } = useReactFlow();
  const { dimMs } = resolveMotion(useReducedMotion());
  const flowId = playback?.flow.id ?? null;
  const current = playback?.played.steps.find((s) => s.step.id === playback.currentStepId);
  const stepNodes = current === undefined ? [] : [current.from, current.to];
  const stepKey = stepNodes.join('>');
  const stepFlow = useRef<string | null>(null);

  // Effect events read the latest deck without making every deck change re-run the effects.
  const fitFlow = useEffectEvent(() => {
    const ids = playback?.played.steps.flatMap((s) => [s.from, s.to]) ?? [];
    const box = boundsOf(
      deck,
      ids.filter((id): id is string => id !== null),
    );
    if (box === null) return;
    const root = wrapper.current;
    if (root === null || root.clientWidth === 0) {
      void fitBounds(box, { padding: 0.2, duration: dimMs });
      return;
    }
    // Canvas-first (018): fit into the area the flyout, player and panels leave free (design 90).
    const size = { width: root.clientWidth, height: root.clientHeight };
    void setViewport(
      fitRectInFreeArea(box, size, currentInsets(true), {
        padding: 0.2,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
      }),
      { duration: dimMs },
    );
  });
  const showStep = useEffectEvent((ids: string[]) => {
    const root = wrapper.current;
    const box = boundsOf(deck, ids);
    if (root === null || box === null || root.clientWidth === 0) return;
    const viewport = getViewport();
    const size = { width: root.clientWidth, height: root.clientHeight };
    if (rectInView(box, viewport, size)) return;
    void setCenter(box.x + box.width / 2, box.y + box.height / 2, {
      zoom: viewport.zoom,
      duration: dimMs,
    });
  });

  useEffect(() => {
    if (flowId === null) return;
    const frame = requestAnimationFrame(() => {
      fitFlow();
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [flowId]);

  useEffect(() => {
    // Opening a flow fits the whole path, which already shows the first step.
    const opened = stepFlow.current !== flowId;
    stepFlow.current = flowId;
    if (flowId === null || stepKey === '' || opened) return;
    const frame = requestAnimationFrame(() => {
      showStep(stepKey.split('>').filter((id) => id !== ''));
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [flowId, stepKey]);
}

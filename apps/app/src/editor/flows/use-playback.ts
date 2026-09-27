import { MOTION } from '@sododeck/ui/lib/motion';
import { useEffect } from 'react';

import { useEditor } from '../../model/use-editor';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import { advancePlayback } from './flow-mode';

/**
 * Autoplay (007 FR-010): while playing, one timeout per step moves to the next step after
 * `stepMs / speed`; the last step stops playback. Keyed on the step, so every change of step,
 * speed or flow replaces the single pending timeout. A hidden tab pauses.
 */
export function usePlayback(): void {
  const editor = useEditor();
  const playing = useUiStore((s) => isFlowMode(s) && s.activeFlow?.playing === true);
  const flowId = useUiStore((s) => s.activeFlow?.flowId ?? null);
  const stepId = useUiStore((s) => s.activeFlow?.stepId ?? null);
  const alternativeId = useUiStore((s) => s.activeFlow?.alternativeId ?? null);
  const speed = useUiStore((s) => s.activeFlow?.speed ?? 1);

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      advancePlayback(editor);
    }, MOTION.stepMs / speed);
    return () => {
      clearTimeout(timer);
    };
  }, [editor, playing, flowId, stepId, alternativeId, speed]);

  useEffect(() => {
    if (!playing || typeof document === 'undefined') return;
    const onVisibility = () => {
      if (document.hidden) useUiStore.getState().setPlaying(false);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [playing]);
}

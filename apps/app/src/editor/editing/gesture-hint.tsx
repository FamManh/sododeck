/**
 * The hint bar of the running gesture (016 R13, contract "Hint bar texts"): the modifier keys of
 * a marquee, a drag, a group drag or a resize, bottom centre over the canvas. The same text is
 * announced once per gesture in the polite live region. Hidden with Hide UI.
 */
import { HintBar } from '@sododeck/ui/components/hint-bar';
import { useEffect } from 'react';

import { useUiStore } from '../../state/ui-store';
import { gestureHint, hintText } from './gesture-hints';

export function GestureHint() {
  const gesture = useUiStore((s) => s.canvasGesture);
  const hidden = useUiStore((s) => s.hideUi);
  const items = gestureHint(gesture);
  const text = hintText(items);

  // Once per gesture: the effect runs when the gesture (and so the text) changes.
  useEffect(() => {
    if (text !== '') useUiStore.getState().announce(text);
  }, [text]);

  if (items.length === 0 || hidden) return null;
  return (
    <HintBar
      items={items}
      className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2"
      data-testid="gesture-hint"
    />
  );
}

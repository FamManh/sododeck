import { serializeDeck } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { useEffect, useRef, useState } from 'react';

/** At most one Deck text update per this many ms (004 research R2; spec allows 500). */
export const DECK_TEXT_THROTTLE_MS = 250;

/**
 * The Deck tab text: `serializeDeck` of the snapshot, the exact exported file. Serializes only
 * while `enabled` (the Deck tab is visible and the panel open), at most once every 250 ms, with a
 * leading and a trailing update so the final state always lands. The leading update runs in the
 * mount effect, before the lazy viewer shows anything.
 */
export function useThrottledDeckText(deck: SododeckFile, enabled: boolean): string {
  const [text, setText] = useState('');
  const shown = useRef<SododeckFile | null>(null);
  const lastRun = useRef(-Infinity);
  const wasEnabled = useRef(false);

  useEffect(() => {
    if (!enabled) {
      wasEnabled.current = false;
      return;
    }
    // Showing the tab (or expanding the panel) must not wait for the previous throttle window.
    const justEnabled = !wasEnabled.current;
    wasEnabled.current = true;
    if (shown.current === deck) return;
    const run = () => {
      shown.current = deck;
      lastRun.current = Date.now();
      setText(serializeDeck(deck));
    };
    const wait = justEnabled ? 0 : lastRun.current + DECK_TEXT_THROTTLE_MS - Date.now();
    if (wait <= 0) {
      run();
      return;
    }
    const timer = setTimeout(run, wait);
    return () => {
      clearTimeout(timer);
    };
  }, [deck, enabled]);

  return text;
}

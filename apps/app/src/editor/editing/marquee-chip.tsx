/**
 * The count chip of a running marquee (016 R13, screen 108): an Inverse 22 px chip with the
 * number of selected cards, next to the pointer. Presentational; the count is UI state.
 */
import { useEffect, useState } from 'react';

import { useUiStore } from '../../state/ui-store';

export function MarqueeChip() {
  const count = useUiStore((s) => s.marqueeCount);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const active = count !== null;

  useEffect(() => {
    if (!active) return;
    const onMove = (event: PointerEvent | MouseEvent) => {
      setAt({ x: event.clientX, y: event.clientY });
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('mousemove', onMove);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('mousemove', onMove);
      setAt(null);
    };
  }, [active]);

  if (count === null) return null;
  return (
    <span
      data-testid="marquee-chip"
      aria-hidden
      className="pointer-events-none fixed z-30 flex h-5.5 min-w-5.5 items-center justify-center rounded-full bg-inverse px-1.5 font-mono text-caption text-on-inverse"
      style={at === null ? { display: 'none' } : { left: at.x + 12, top: at.y + 12 }}
    >
      {count}
    </span>
  );
}

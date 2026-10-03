import { RotateCcw } from 'lucide-react';

/**
 * Replays a play-once visual. Hidden until the page script knows the visual can play (JS on,
 * motion allowed); the script handles the click.
 */
export function ReplayButton({ position }: { position: 'top' | 'bottom' }) {
  return (
    <button
      type="button"
      className="sdl-replay"
      data-position={position}
      aria-label="Replay animation"
      hidden
    >
      <RotateCcw aria-hidden size={14} strokeWidth={2} />
      Replay
    </button>
  );
}

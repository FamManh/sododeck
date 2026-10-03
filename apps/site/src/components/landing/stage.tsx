import type { ReactNode } from 'react';

import type { Timeline } from '../../lib/landing/timeline';
import { KeyframesStyle } from './keyframes-style';
import { ReplayButton } from './replay-button';

interface StageProps {
  /** `null`: a static visual. */
  timeline: Timeline | null;
  /** Where the Replay button sits (plays that run once only). */
  replay?: 'top' | 'bottom';
  className?: string;
  children: ReactNode;
}

/**
 * Wraps an animated visual. The page script (`landing-motion.ts`) sets `data-play` on the stage
 * when it may play: a loop starts at once, a play-once stage when 35 % of it is in view. Until
 * then, and always under reduced motion or without JS, the visual shows its final frame.
 */
export function Stage({ timeline, replay, className, children }: StageProps) {
  if (timeline === null) return <div className={className}>{children}</div>;
  return (
    <div
      className={['sdl-stage', className].filter(Boolean).join(' ')}
      data-motion={timeline.loop ? 'loop' : 'once'}
      style={{ position: 'relative' }}
    >
      {children}
      {replay !== undefined && <ReplayButton position={replay} />}
      {/* Last, so it renders after every animated element has registered its keyframes. */}
      <KeyframesStyle timeline={timeline} />
    </div>
  );
}

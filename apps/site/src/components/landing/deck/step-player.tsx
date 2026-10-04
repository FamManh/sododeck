import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';

import { STEPS } from '../../../lib/landing/checkout-deck';
import { animate, type Key, type Timeline } from '../../../lib/landing/timeline';
import { C, FONT_MONO } from '../../../lib/landing/tokens';
import { FloatingPanel } from './floating-panel';

interface StepPlayerProps {
  /** Left edge in the frame; a string allows `calc()` centring. */
  x: number | string;
  y: number;
  width: number;
  /** The step shown at rest (0-based). */
  current: number;
  /** Steps the player shows text for while playing (0-based). */
  shown: readonly number[];
  /** When each step becomes current, by step index; `null` for steps played before. */
  times: readonly (number | null)[];
  /** Phones: no speed chip, two-line step text. */
  compact?: boolean;
  timeline: Timeline | null;
}

/** Visible while `a ≤ t < b` (or from `a` on for the last step). */
const during = (a: number, b: number | null | undefined): Key[] =>
  b === undefined || b === null
    ? [
        [a, { opacity: 0 }],
        [a + 0.05, { opacity: 1 }],
      ]
    : [
        [a, { opacity: 0 }],
        [a + 0.05, { opacity: 1 }],
        [b, { opacity: 1 }],
        [b + 0.05, { opacity: 0 }],
      ];

/**
 * The flow step player (007, 035): previous, play / pause, next, the current step and one
 * segment per step. Buttons are real: `landing-motion.ts` seeks the stage's timeline to a step
 * (steps with a time only; earlier steps were played before the visual starts).
 */
export function StepPlayer({
  x,
  y,
  width,
  current,
  shown,
  times,
  compact = false,
  timeline,
}: StepPlayerProps) {
  return (
    <FloatingPanel
      className="ld-player"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        zIndex: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 10 : 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 'none' }}>
          <button
            type="button"
            className="ld-player-skip"
            data-player="prev"
            aria-label="Previous step"
          >
            <SkipBack aria-hidden size={15} strokeWidth={2} />
          </button>
          <button type="button" className="ld-player-toggle" data-player="toggle" aria-label="Play">
            <Play aria-hidden className="ld-icon-play" size={18} strokeWidth={2.25} />
            <Pause aria-hidden className="ld-icon-pause" size={18} strokeWidth={2.25} />
          </button>
          <button
            type="button"
            className="ld-player-skip"
            data-player="next"
            aria-label="Next step"
          >
            <SkipForward aria-hidden size={15} strokeWidth={2} />
          </button>
        </div>
        <div
          aria-live="polite"
          style={{ position: 'relative', flex: 1, minWidth: 0, height: compact ? 54 : 38 }}
        >
          {shown.map((i) => {
            const a = times[i];
            const motion =
              a === undefined || a === null ? {} : animate(timeline, during(a, times[i + 1]));
            const step = STEPS[i];
            return (
              <div
                key={i}
                data-step-row={i}
                aria-hidden={i === current ? undefined : true}
                className={motion.className}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  right: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  opacity: i === current ? 1 : 0,
                  ...motion.style,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Step {i + 1} of 8</span>
                  <span style={{ fontSize: 11.5, color: C.muted }}>Checkout</span>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    lineHeight: 1.4,
                    color: C.inkSecondary,
                    textWrap: 'pretty',
                  }}
                >
                  {step === undefined ? '' : `${step[0]} · ${step[1]}`}
                </span>
              </div>
            );
          })}
        </div>
        {!compact && (
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              padding: '2px 7px',
              borderRadius: 99,
              background: C.surface2,
              color: C.inkSecondary,
              flex: 'none',
            }}
          >
            1×
          </span>
        )}
      </div>
      <div
        // The 6px padding makes each segment an easier target without moving the bar.
        style={{ display: 'flex', gap: 4, margin: '-6px 0' }}
        role="group"
        aria-label="Steps"
      >
        {STEPS.map((_, i) => {
          const a = times[i];
          const b = times[i + 1];
          const motion =
            a === undefined || a === null
              ? {}
              : animate(
                  timeline,
                  b === undefined || b === null
                    ? [
                        [Math.max(0, a - 0.01), { backgroundColor: C.surface3 }],
                        [a, { backgroundColor: C.primary }],
                      ]
                    : [
                        [Math.max(0, a - 0.01), { backgroundColor: C.surface3 }],
                        [a, { backgroundColor: C.primary }],
                        [b, { backgroundColor: C.primary }],
                        [b + 0.01, { backgroundColor: C.inkSecondary }],
                      ],
                );
          const rest = i < current ? C.inkSecondary : i === current ? C.primary : C.surface3;
          const bar = (
            <span
              className={motion.className}
              style={{
                display: 'block',
                height: 8,
                borderRadius: 4,
                backgroundColor: rest,
                ...motion.style,
              }}
            />
          );
          // Steps played before the visual starts have no time on its timeline: not seekable.
          return a === undefined || a === null ? (
            <span key={i} aria-hidden style={{ flex: 1, padding: '6px 0' }}>
              {bar}
            </span>
          ) : (
            <button
              key={i}
              type="button"
              className="ld-player-segment"
              data-seek-step={i}
              aria-label={`Step ${String(i + 1)}`}
              aria-current={i === current ? 'step' : undefined}
            >
              {bar}
            </button>
          );
        })}
      </div>
    </FloatingPanel>
  );
}

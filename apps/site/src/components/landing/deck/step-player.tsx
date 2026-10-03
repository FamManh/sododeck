import { Pause, SkipBack, SkipForward } from 'lucide-react';
import type { ReactNode } from 'react';

import { STEPS } from '../../../lib/landing/checkout-deck';
import { animate, type Timeline } from '../../../lib/landing/timeline';
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
  compact?: boolean;
  timeline: Timeline | null;
}

const iconButton = (icon: ReactNode) => (
  <span
    style={{
      width: 28,
      height: 28,
      borderRadius: 99,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: C.inkSecondary,
      flex: 'none',
    }}
  >
    {icon}
  </span>
);

/** The flow step player (007, 035): controls, the current step and an 8-segment progress bar. */
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 'none' }}>
          {!compact && iconButton(<SkipBack aria-hidden size={15} strokeWidth={2} />)}
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 99,
              background: C.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 3px 0 0 ${C.primaryInk}`,
            }}
          >
            <Pause aria-hidden size={18} strokeWidth={2.25} color={C.onPrimary} />
          </span>
          {!compact && iconButton(<SkipForward aria-hidden size={15} strokeWidth={2} />)}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: 0, height: compact ? 54 : 38 }}>
          {shown.map((i) => {
            const a = times[i];
            const b = times[i + 1];
            const motion =
              a === undefined || a === null
                ? {}
                : animate(
                    timeline,
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
                        ],
                  );
            const step = STEPS[i];
            return (
              <div
                key={i}
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
      </div>
      <div style={{ display: 'flex', gap: 4 }} aria-hidden>
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
          return (
            <span
              key={i}
              className={motion.className}
              style={{
                flex: 1,
                height: 8,
                borderRadius: 4,
                backgroundColor: rest,
                ...motion.style,
              }}
            />
          );
        })}
      </div>
    </FloatingPanel>
  );
}

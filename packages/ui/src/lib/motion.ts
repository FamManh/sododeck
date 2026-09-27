/**
 * Motion timing in milliseconds. Mirrors the `--sd-dur-*`, `--sd-flow-*` and `--sd-toast`
 * tokens in tokens.css (a test keeps them in sync), for JS timers such as flow autoplay and
 * toast dismissal.
 */
export interface Motion {
  /** Opacity of dimmed nodes/edges (focus, flow, view). */
  dimMs: number;
  /** Selection ring, tour dot width. */
  ringMs: number;
  /** Token travelling along the current flow edge. 0 means: do not loop, show a static marker. */
  tokenLoopMs: number;
  /** Autoplay step interval at 1×; callers divide by speed. */
  stepMs: number;
  /** Toast display time. */
  toastMs: number;
}

export const MOTION = {
  dimMs: 250,
  ringMs: 200,
  tokenLoopMs: 1400,
  stepMs: 1700,
  toastMs: 2600,
} as const satisfies Motion;

/**
 * Motion values for the user's preference. Reduced motion removes animation, but keeps
 * step and toast durations because they are reading time.
 */
export function resolveMotion(reduced: boolean): Motion {
  if (!reduced) return { ...MOTION };
  return { ...MOTION, dimMs: 0, ringMs: 0, tokenLoopMs: 0 };
}

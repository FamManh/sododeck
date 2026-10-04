/**
 * Pure step logic of the Flows player: which step is current at a time on the stage's timeline,
 * and where previous / next / a segment seek to.
 */

export interface SeekStep {
  /** 0-based step index (step 3 is 2). */
  index: number;
  /** When it becomes current, in seconds. */
  time: number;
}

/**
 * Seeking to a step lands a little after it starts, so its sticker, player text and played
 * connector have settled; the last step lands on the final frame.
 */
export const SETTLE = 0.2;

/** Parses a stage's `data-steps` ("2:0 3:1.5 …"), sorted by time. */
export function parseSteps(value: string | undefined): SeekStep[] {
  if (value === undefined || value.trim() === '') return [];
  return value
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [index = '', time = ''] = pair.split(':');
      return { index: Number(index), time: Number(time) };
    })
    .filter((s) => Number.isFinite(s.index) && Number.isFinite(s.time))
    .sort((a, b) => a.time - b.time);
}

/** The step current at time `t` (the last one that has started), or the first step. */
export function stepAt(steps: readonly SeekStep[], t: number): SeekStep | undefined {
  let found = steps[0];
  for (const step of steps) if (step.time <= t + 1e-6) found = step;
  return found;
}

/** The time a seek to `step` shows: settled into the step, or the end for the last one. */
export function seekTime(steps: readonly SeekStep[], step: SeekStep, end: number): number {
  const last = steps[steps.length - 1];
  return step === last ? end : Math.min(end, step.time + SETTLE);
}

/** The step after the one current at `t` (stays on the last). */
export function nextStep(steps: readonly SeekStep[], t: number): SeekStep | undefined {
  const current = stepAt(steps, t);
  const i = current === undefined ? -1 : steps.indexOf(current);
  return steps[Math.min(steps.length - 1, i + 1)];
}

/** The step before the one current at `t` (stays on the first). */
export function prevStep(steps: readonly SeekStep[], t: number): SeekStep | undefined {
  const current = stepAt(steps, t);
  const i = current === undefined ? 0 : steps.indexOf(current);
  return steps[Math.max(0, i - 1)];
}

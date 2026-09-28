import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { MOTION, resolveMotion } from '../src/lib/motion';

const tokensCss = readFileSync(resolve(import.meta.dirname, '../src/styles/tokens.css'), 'utf8');

/** Reads `--name: <n>ms` from a CSS block. */
function ms(block: string, name: string): number | undefined {
  const match = new RegExp(`--${name}:\\s*(\\d+)ms`).exec(block);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

const rootBlock = /:root\s*\{([^}]*)\}/.exec(tokensCss)?.[1] ?? '';
const reducedBlock =
  /@media \(prefers-reduced-motion: reduce\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(tokensCss)?.[1] ?? '';

describe('MOTION', () => {
  it('has the specified default values', () => {
    expect(MOTION).toEqual({
      dimMs: 250,
      ringMs: 200,
      overlayMs: 120,
      tokenLoopMs: 1400,
      stepMs: 1700,
      toastMs: 2600,
      toastUndoMs: 6000,
    });
  });
});

describe('resolveMotion', () => {
  it('returns the defaults when motion is not reduced', () => {
    expect(resolveMotion(false)).toEqual(MOTION);
  });

  it('zeroes transitions and the token loop but keeps reading time when reduced', () => {
    expect(resolveMotion(true)).toEqual({
      dimMs: 0,
      ringMs: 0,
      overlayMs: 0,
      tokenLoopMs: 0,
      stepMs: 1700,
      toastMs: 2600,
      toastUndoMs: 6000,
    });
  });
});

describe('tokens.css agrees with motion.ts', () => {
  it('default values', () => {
    expect(ms(rootBlock, 'sd-dur-dim')).toBe(MOTION.dimMs);
    expect(ms(rootBlock, 'sd-dur-ring')).toBe(MOTION.ringMs);
    expect(ms(rootBlock, 'sd-dur-overlay')).toBe(MOTION.overlayMs);
    expect(ms(rootBlock, 'sd-flow-token-loop')).toBe(MOTION.tokenLoopMs);
    expect(ms(rootBlock, 'sd-flow-step')).toBe(MOTION.stepMs);
    expect(ms(rootBlock, 'sd-toast')).toBe(MOTION.toastMs);
    expect(ms(rootBlock, 'sd-toast-undo')).toBe(MOTION.toastUndoMs);
  });

  it('reduced-motion values', () => {
    const reduced = resolveMotion(true);
    expect(ms(reducedBlock, 'sd-dur-dim')).toBe(reduced.dimMs);
    expect(ms(reducedBlock, 'sd-dur-ring')).toBe(reduced.ringMs);
    expect(ms(reducedBlock, 'sd-dur-overlay')).toBe(reduced.overlayMs);
    expect(ms(reducedBlock, 'sd-flow-token-loop')).toBe(reduced.tokenLoopMs);
    // Hover color transitions (Tailwind's default duration) also stop.
    expect(ms(rootBlock, 'sd-dur-hover')).toBe(150);
    expect(ms(reducedBlock, 'sd-dur-hover')).toBe(0);
    // Reading time is never overridden.
    expect(ms(reducedBlock, 'sd-flow-step')).toBeUndefined();
    expect(ms(reducedBlock, 'sd-toast')).toBeUndefined();
    expect(ms(reducedBlock, 'sd-toast-undo')).toBeUndefined();
  });
});

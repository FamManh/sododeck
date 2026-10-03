import type { CSSProperties } from 'react';

/**
 * Build-time CSS keyframes for the landing page animations (hero loop, Flows and Database plays).
 *
 * A visual creates one `Timeline` (duration, loop) and asks it for the animation of each element
 * as a list of keys `[seconds, style, timing?]`. The timeline turns those into `@keyframes`
 * (named by a hash of their body, so equal ones are shared) and returns the element's inline
 * style: the custom property `--sdl-a` holding its `animation` shorthand plus the class `sdl-a`.
 * The animation only runs while the visual's stage has `data-play` (set by the page script when
 * it is in view and motion is allowed). Without it, every element shows its own inline style,
 * which is always the final frame: no JS and reduced motion get the finished picture.
 */

export type KeyStyle = Readonly<Record<string, string | number>>;
/** One key: time in seconds, the style at that time, and the timing function from it. */
export type Key = readonly [time: number, style: KeyStyle, timing?: string];

export interface Animated {
  className: 'sdl-a';
  style: CSSProperties;
}

const kebab = (name: string): string => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const declarations = (style: KeyStyle): string =>
  Object.entries(style)
    .map(([key, value]) => `${kebab(key)}:${String(value)}`)
    .join(';');

/** djb2, base 36: a short, stable name for a keyframes body. */
export function hashName(body: string): string {
  let hash = 5381;
  for (let i = 0; i < body.length; i++) hash = ((hash << 5) + hash + body.charCodeAt(i)) | 0;
  return `sdl-${(hash >>> 0).toString(36)}`;
}

/**
 * The `@keyframes` body for `keys` over `duration` seconds. A first key after 0 also holds at 0%,
 * and the last key holds until 100%, so the element rests in its first and last state.
 */
export function keyframesBody(keys: readonly Key[], duration: number): string {
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (first === undefined || last === undefined) return '';
  const percent = (time: number): string =>
    `${(Math.max(0, Math.min(100, (time / duration) * 100)) || 0).toFixed(3)}%`;
  const timing = (key: Key): string =>
    key[2] === undefined ? '' : `;animation-timing-function:${key[2]}`;
  const frames: string[] = [];
  if (first[0] > 0) frames.push(`0%{${declarations(first[1])}${timing(first)}}`);
  for (const key of keys) frames.push(`${percent(key[0])}{${declarations(key[1])}${timing(key)}}`);
  if (last[0] < duration) frames.push(`100%{${declarations(last[1])}}`);
  return frames.join('');
}

export class Timeline {
  private readonly rules = new Map<string, string>();

  constructor(
    readonly duration: number,
    readonly loop: boolean,
  ) {}

  /** The inline style and class that play `keys` on this timeline. */
  animate(keys: readonly Key[]): Animated {
    const body = keyframesBody(keys, this.duration);
    const name = hashName(body);
    this.rules.set(name, body);
    const iterations = this.loop ? 'infinite' : '1';
    return {
      className: 'sdl-a',
      style: {
        '--sdl-a': `${name} ${String(this.duration)}s ease 0s ${iterations} both`,
      } as CSSProperties,
    };
  }

  /** Every `@keyframes` rule this timeline produced, for one <style> element. */
  css(): string {
    return [...this.rules].map(([name, body]) => `@keyframes ${name}{${body}}`).join('\n');
  }
}

/**
 * Animates on `timeline` when there is one; a static visual (no timeline) gets nothing, so it shows
 * its final frame.
 */
export function animate(timeline: Timeline | null, keys: readonly Key[]): Partial<Animated> {
  return timeline === null ? {} : timeline.animate(keys);
}

/** Merges an element's own style with an animation (class names joined). */
export function withAnimation(
  style: CSSProperties,
  animation: Partial<Animated>,
  className?: string,
): { style: CSSProperties; className?: string } {
  const classes = [className, animation.className].filter(Boolean).join(' ');
  return {
    style: { ...style, ...animation.style },
    ...(classes === '' ? {} : { className: classes }),
  };
}

/** Fade (and optionally slide) in between `t0` and `t0 + d`. */
export function fadeIn(
  timeline: Timeline | null,
  t0: number,
  d = 0.35,
  from: KeyStyle = {},
): Partial<Animated> {
  const hasTransform = 'transform' in from;
  return animate(timeline, [
    [t0, { opacity: 0, ...from }],
    [t0 + d, { opacity: 1, ...(hasTransform ? { transform: 'none' } : {}) }],
  ]);
}

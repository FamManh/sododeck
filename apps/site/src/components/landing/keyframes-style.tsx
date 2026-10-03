import type { Timeline } from '../../lib/landing/timeline';

/** The `@keyframes` a timeline collected while its visual rendered. */
export function KeyframesStyle({ timeline }: { timeline: Timeline }) {
  return <style>{timeline.css()}</style>;
}

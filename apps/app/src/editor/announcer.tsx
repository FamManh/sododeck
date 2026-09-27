import { useUiStore } from '../state/ui-store';

/**
 * The editor's polite live region (FR-029). Visually hidden. A repeated identical message gets
 * an alternating zero-width suffix, so screen readers announce it again.
 */
export function Announcer() {
  const { text, seq } = useUiStore((s) => s.announcement);
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {text === '' ? '' : `${text}${seq % 2 === 0 ? '' : '​'}`}
    </div>
  );
}

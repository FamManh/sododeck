import { C, FONT_MONO } from '../../../lib/landing/tokens';

/** A small key cap, e.g. ⏎ on a drill-in card. */
export function KeyCap({ label }: { label: string }) {
  return (
    <span
      aria-hidden
      style={{
        fontFamily: FONT_MONO,
        fontSize: 10,
        color: C.inkSecondary,
        border: `1px solid ${C.border}`,
        borderRadius: 4,
        padding: '0 4px',
        height: 16,
        display: 'inline-flex',
        alignItems: 'center',
        flex: 'none',
      }}
    >
      {label}
    </span>
  );
}

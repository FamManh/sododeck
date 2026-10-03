import { C } from '../../../lib/landing/tokens';

/** The numbered flow token (035): an orange disc with a surface ring and an orange-ink lip. */
export function FlowToken({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        left: -12,
        top: -12,
        width: 24,
        height: 24,
        borderRadius: 12,
        background: C.primary,
        border: `2.5px solid ${C.surface}`,
        boxShadow: `0 3px 0 0 ${C.primaryInk}`,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11.5,
        fontWeight: 700,
        color: C.onPrimary,
        zIndex: 4,
      }}
    >
      {n}
    </span>
  );
}

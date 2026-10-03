import type { ReactNode } from 'react';

import { C } from '../../../lib/landing/tokens';

/** A neutral chip in a panel header, e.g. the dialect or "Selection". */
export function NeutralChip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span
      style={{
        flex: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 26,
        padding: '0 10px',
        borderRadius: 99,
        background: C.surface2,
        color: C.inkSecondary,
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {children}
    </span>
  );
}

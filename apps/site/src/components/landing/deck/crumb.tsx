import { ChevronRight } from 'lucide-react';
import { Fragment, type CSSProperties } from 'react';

import { C } from '../../../lib/landing/tokens';
import { CanvasPill } from './canvas-pill';

/** The drill-in breadcrumb, e.g. Checkout › Orders › Orders DB. */
export function Crumb({ parts, style }: { parts: readonly string[]; style?: CSSProperties }) {
  return (
    <CanvasPill height={32} style={{ left: 12, top: 12, gap: 6, color: C.inkSecondary, ...style }}>
      {parts.map((part, i) => {
        const last = i === parts.length - 1;
        return (
          <Fragment key={part}>
            {i > 0 && <ChevronRight aria-hidden size={13} strokeWidth={2} color={C.muted} />}
            <span style={{ fontWeight: last ? 600 : 400, color: last ? C.ink : C.inkSecondary }}>
              {part}
            </span>
          </Fragment>
        );
      })}
    </CanvasPill>
  );
}

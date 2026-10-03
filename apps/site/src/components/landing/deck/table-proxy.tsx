import { Table as TableIcon } from 'lucide-react';

import { C } from '../../../lib/landing/tokens';

interface TableProxyProps {
  name: string;
  detail: string;
  width: number;
}

/** A dashed stand-in for a table in another database (034 outside proxy). */
export function TableProxy({ name, detail, width }: TableProxyProps) {
  return (
    <div
      style={{
        width,
        height: 46,
        boxSizing: 'border-box',
        border: `1.5px dashed ${C.inkSecondary}`,
        borderRadius: 14,
        background: C.canvas,
        padding: '0 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        color: C.ink,
      }}
    >
      <TableIcon
        aria-hidden
        size={14}
        strokeWidth={2}
        color={C.inkSecondary}
        style={{ flex: 'none' }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{name}</span>
        <span style={{ fontSize: 10.5, color: C.muted, whiteSpace: 'nowrap' }}>{detail}</span>
      </div>
    </div>
  );
}

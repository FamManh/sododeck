import type { CSSProperties } from 'react';

import { C, FONT_MONO } from '../../lib/landing/tokens';

const ROWS = [
  ['< 3', 'timeout', 'Retry in 2 s'],
  ['< 3', 'declined_soft', 'Retry in 30 s'],
  ['3', 'any', 'Cancel order'],
  ['any', 'declined_hard', 'Cancel order'],
] as const;

const band = (gridColumn: string, background: string, color: string): CSSProperties => ({
  gridColumn,
  height: 22,
  display: 'flex',
  alignItems: 'center',
  padding: '0 8px',
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: '.07em',
  background,
  color,
});

/** Rule R-12 as a decision table (008): WHEN attempt and error, THEN the action; row 1 matches. */
export function DecisionTable() {
  return (
    <table
      style={{
        display: 'grid',
        gridTemplateColumns: '62px minmax(0,1.1fr) minmax(0,1fr)',
        border: `1.5px solid ${C.borderStrong}`,
        borderRadius: 12,
        overflow: 'hidden',
        background: C.surface,
        borderCollapse: 'separate',
      }}
    >
      <thead style={{ display: 'contents' }}>
        <tr style={{ display: 'contents' }}>
          <th colSpan={2} style={band('1 / 3', C.amberSoft, C.amberInk)}>
            WHEN
          </th>
          <th style={band('3 / 4', C.primarySoft, C.primaryInk)}>THEN</th>
        </tr>
        <tr style={{ display: 'contents' }}>
          {['attempt', 'error', 'action'].map((label) => (
            <th
              key={label}
              style={{
                height: 24,
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px',
                fontFamily: FONT_MONO,
                fontSize: 10.5,
                fontWeight: 400,
                color: C.muted,
              }}
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody style={{ display: 'contents' }}>
        {ROWS.map((row, i) => {
          const match = i === 0;
          return (
            <tr key={row.join('|')} style={{ display: 'contents' }}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  style={{
                    minHeight: 30,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                    fontSize: 11.5,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    borderTop: `1px solid ${C.hairline}`,
                    ...(j < 2 ? { fontFamily: FONT_MONO } : {}),
                    ...(match
                      ? { background: C.primarySoft, color: C.primaryInk, fontWeight: 500 }
                      : {}),
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

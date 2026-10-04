import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

import type { Animated } from '../../../lib/landing/timeline';
import { C, FONT_MONO } from '../../../lib/landing/tokens';

export interface CodePanelData {
  tab: string;
  lines: readonly string[];
  /** 0-based line indexes drawn as selected. */
  highlight?: readonly number[];
  /** Lines that belong to a pickable card, by card key; lit while that card is picked. */
  refs?: Readonly<Record<string, readonly number[]>>;
  /** Footer text; `false` hides the footer. */
  foot?: string | false;
  lineMotion?: (index: number) => Partial<Animated>;
}

const KEYWORD = /^(\s*)(Table|Enum|indexes|CREATE)\b/;

/** A code line with its leading DBML / SQL keyword tinted. */
function syntax(line: string): ReactNode {
  const match = KEYWORD.exec(line);
  if (match === null) return line;
  const [whole, indent = '', keyword = ''] = match;
  return (
    <>
      {indent}
      <span style={{ color: C.primaryInk, fontWeight: 500 }}>{keyword}</span>
      {line.slice(whole.length)}
    </>
  );
}

interface CodeLinesProps {
  panel: CodePanelData;
  narrow: boolean;
  selected?: string;
}

/** The numbered lines of one code panel and its footer. */
export function CodeLines({ panel, narrow, selected }: CodeLinesProps) {
  const { lines, highlight = [], refs = {}, foot, lineMotion } = panel;
  const refOf = (i: number): string | undefined =>
    Object.keys(refs).find((key) => refs[key]?.includes(i));
  return (
    <>
      <div style={{ flex: 1, padding: '8px 0', overflow: 'hidden', background: C.code }}>
        {lines.map((line, i) => {
          const motion = lineMotion?.(i) ?? {};
          const ref = refOf(i);
          return (
            <div
              // Lines repeat (blank lines, braces), so the index is the identity.
              key={i}
              data-ref={ref}
              data-on={ref !== undefined && ref === selected ? '' : undefined}
              className={['ld-code-line', motion.className].filter(Boolean).join(' ')}
              style={{
                display: 'flex',
                height: 19,
                fontFamily: FONT_MONO,
                fontSize: 11.5,
                lineHeight: '19px',
                whiteSpace: 'pre',
                ...(highlight.includes(i) ? { background: C.primarySoft } : {}),
                ...motion.style,
              }}
            >
              <span
                style={{
                  width: 34,
                  flex: 'none',
                  textAlign: 'right',
                  paddingRight: 10,
                  color: C.muted,
                  boxSizing: 'border-box',
                }}
              >
                {i + 1}
              </span>
              <span style={{ color: C.ink, flex: 1, overflow: 'hidden' }}>{syntax(line)}</span>
            </div>
          );
        })}
      </div>
      {foot !== false && foot !== undefined && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 44,
            padding: '0 12px',
            borderTop: `1px solid ${C.border}`,
            flex: 'none',
            fontSize: 12,
            color: C.inkSecondary,
            whiteSpace: 'nowrap',
          }}
        >
          <RefreshCw aria-hidden size={13} strokeWidth={2} />
          {foot}
          <span style={{ flex: 1 }} />
          {!narrow && (
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted }}>
              checkout.sododeck.json
            </span>
          )}
        </div>
      )}
    </>
  );
}

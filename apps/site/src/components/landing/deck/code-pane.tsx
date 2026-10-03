import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

import type { Animated } from '../../../lib/landing/timeline';
import { C, FLOAT_SHADOW, FONT_MONO } from '../../../lib/landing/tokens';
import { Segmented } from './segmented';

interface CodePaneProps {
  width: number | string;
  height: number;
  tabs: readonly string[];
  active: number;
  lines: readonly string[];
  /** 0-based line indexes drawn as selected. */
  highlight?: readonly number[];
  /** Footer text; `false` hides the footer. */
  foot?: string | false;
  /** Hides the file name in the footer. */
  narrow?: boolean;
  chip?: ReactNode;
  lineMotion?: (index: number) => Partial<Animated>;
  /** Takes the free width of a flex row instead of `width`. */
  grow?: boolean;
}

const KEYWORD = /^(\s*)(Table|Enum|indexes)\b/;

/** Code panel line with DBML keywords tinted. */
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

/** The code panel (004, 046): tabs, line-numbered code, a sync footer. */
export function CodePane({
  width,
  height,
  tabs,
  active,
  lines,
  highlight = [],
  foot,
  narrow = false,
  chip,
  lineMotion,
  grow = false,
}: CodePaneProps) {
  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        flex: grow ? '1 1 0' : 'none',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        boxShadow: FLOAT_SHADOW,
        boxSizing: 'border-box',
        color: C.ink,
        maxWidth: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 48,
          padding: '0 10px',
          borderBottom: `1px solid ${C.border}`,
          flex: 'none',
        }}
      >
        <Segmented items={tabs} active={active} />
        <span style={{ flex: 1 }} />
        {chip}
      </div>
      <div style={{ flex: 1, padding: '8px 0', overflow: 'hidden', background: C.code }}>
        {lines.map((line, i) => {
          const motion = lineMotion?.(i) ?? {};
          return (
            <div
              // Lines repeat (blank lines, braces), so the index is the identity.
              key={i}
              className={motion.className}
              style={{
                display: 'flex',
                height: 19,
                fontFamily: FONT_MONO,
                fontSize: 11.5,
                lineHeight: '19px',
                background: highlight.includes(i) ? C.primarySoft : 'transparent',
                whiteSpace: 'pre',
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
    </div>
  );
}

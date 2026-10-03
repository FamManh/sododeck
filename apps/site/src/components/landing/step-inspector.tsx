import { ArrowRight, Table } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

import { C, FONT_MONO } from '../../lib/landing/tokens';
import { DecisionTable } from './decision-table';
import { FloatingPanel } from './deck/floating-panel';

const microLabel: CSSProperties = {
  fontSize: 10.5,
  letterSpacing: '.07em',
  textTransform: 'uppercase',
  color: C.muted,
  fontWeight: 500,
};

const section = (title: string, children: ReactNode, last = false) => (
  <div
    style={{
      padding: '12px 16px',
      borderBottom: last ? 'none' : `1px solid ${C.hairline}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}
  >
    <span style={microLabel}>{title}</span>
    {children}
  </div>
);

const tag = (text: string) => (
  <span
    style={{
      fontFamily: FONT_MONO,
      fontSize: 11,
      padding: '2px 8px',
      borderRadius: 99,
      background: C.surface2,
      color: C.inkSecondary,
    }}
  >
    {text}
  </span>
);

/** The inspector on flow step 6 (008): the step, its condition, rule R-12 and a note. */
export function StepInspector({ style }: { style?: CSSProperties }) {
  return (
    <FloatingPanel
      style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', ...style }}
    >
      <div
        style={{
          padding: '14px 16px',
          borderBottom: `1px solid ${C.hairline}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <span style={microLabel}>Flow step 6 of 8</span>
        <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.35 }}>
          Payment Service → Payment Provider
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {tag('charge')}
          {tag('HTTPS')}
        </div>
      </div>
      {section(
        'Condition',
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 12,
            padding: '8px 10px',
            borderRadius: 10,
            background: C.code,
            border: `1px solid ${C.hairline}`,
          }}
        >
          <span style={{ color: C.amberInk, fontWeight: 500 }}>when</span> order.total_cents &gt; 0
        </div>,
      )}
      {section(
        'Rule',
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 34,
              padding: '0 10px',
              borderRadius: 10,
              background: C.amberSoft,
              color: C.amberInk,
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            <Table aria-hidden size={14} strokeWidth={2} />
            R-12 Payment retry
            <span style={{ flex: 1 }} />
            <ArrowRight aria-hidden size={14} strokeWidth={2} />
          </div>
          <DecisionTable />
        </>,
      )}
      {section(
        'Note',
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            lineHeight: 1.5,
            color: C.inkSecondary,
            textWrap: 'pretty',
          }}
        >
          Retries reuse the order id, so the provider sees one charge.
        </p>,
        true,
      )}
    </FloatingPanel>
  );
}

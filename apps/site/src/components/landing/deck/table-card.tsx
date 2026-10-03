import { KeyRound, Link2, ListOrdered, Table as TableIcon } from 'lucide-react';

import type { Table } from '../../../lib/landing/checkout-deck';
import { TABLE } from '../../../lib/landing/geometry';
import { tableGeometry } from '../../../lib/landing/schema';
import { C, FONT_MONO, pal } from '../../../lib/landing/tokens';
import { StepSticker } from './step-sticker';

interface TableCardProps {
  table: Table;
  /** The flow step currently writing this table. */
  step?: number;
  /** Columns the current step writes, marked W. */
  writes?: readonly string[];
}

/**
 * A table card of the Database pack: type tile, table name, then one 24px row per column with its
 * key glyphs, name, type (enums as a chip) and, while a flow writes it, a W badge.
 */
export function TableCard({ table, step, writes = [] }: TableCardProps) {
  const g = tableGeometry(table);
  const current = step !== undefined;
  const stroke = current ? C.primary : C.borderStrong;
  return (
    <div
      style={{
        position: 'relative',
        width: g.w,
        height: g.h,
        boxSizing: 'border-box',
        background: C.surface,
        border: `1.5px solid ${stroke}`,
        borderRadius: 14,
        boxShadow: `0 ${String(current ? 5 : 3)}px 0 0 ${stroke}`,
        transform: current ? 'translateY(-2px)' : undefined,
        color: C.ink,
        display: 'flex',
        flexDirection: 'column',
        paddingTop: TABLE.pad,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: TABLE.header,
          margin: `0 ${String(TABLE.pad - 1)}px`,
          flex: 'none',
        }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 8,
            background: C.surface2,
            color: C.inkSecondary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          <TableIcon aria-hidden size={14} strokeWidth={2} />
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 500, color: C.muted }}>Table</span>
      </div>
      <div
        style={{
          height: TABLE.title,
          lineHeight: `${String(TABLE.title)}px`,
          fontSize: 14,
          fontWeight: 600,
          margin: `${String(TABLE.gap)}px ${String(TABLE.pad)}px 0`,
          flex: 'none',
        }}
      >
        {table.name}
      </div>
      <div
        style={{
          height: TABLE.gap,
          display: 'flex',
          alignItems: 'center',
          margin: `0 ${String(TABLE.pad)}px`,
          flex: 'none',
        }}
      >
        <div style={{ flex: 1, height: 1, background: C.hairline }} />
      </div>
      {table.columns.map((column) => {
        const written = writes.includes(column.name);
        return (
          <div
            key={column.name}
            style={{
              height: TABLE.colHeight,
              margin: `0 ${String(TABLE.colInset)}px`,
              padding: '0 8px',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: written ? C.primarySoft : 'transparent',
              boxSizing: 'border-box',
            }}
          >
            <span
              style={{
                width: g.keyWidth,
                display: 'flex',
                gap: 2,
                alignItems: 'center',
                flex: 'none',
              }}
            >
              {column.pk === true && (
                <KeyRound
                  role="img"
                  aria-label="Primary key"
                  size={12}
                  strokeWidth={2.25}
                  color={C.ink}
                />
              )}
              {column.fk !== undefined && (
                <Link2
                  role="img"
                  aria-label="Foreign key"
                  size={12}
                  strokeWidth={2.25}
                  color={C.inkSecondary}
                />
              )}
            </span>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontSize: 12,
                fontWeight: column.pk === true ? 600 : 500,
              }}
            >
              {column.name}
            </span>
            {column.enumName === undefined ? (
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  color: C.muted,
                  whiteSpace: 'nowrap',
                  textAlign: 'right',
                }}
              >
                {column.type}
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 18,
                  padding: '0 6px',
                  borderRadius: 99,
                  background: pal('violet', 'chip'),
                  color: pal('violet', 'ink'),
                  fontFamily: FONT_MONO,
                  fontSize: 10.5,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                {column.enumName}
              </span>
            )}
            <span style={{ width: 7, flex: 'none' }} />
            {written && (
              <span
                aria-label="Written by this step"
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 5,
                  boxSizing: 'border-box',
                  background: C.primary,
                  color: C.onPrimary,
                  fontFamily: FONT_MONO,
                  fontSize: 9.5,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 'none',
                }}
              >
                W
              </span>
            )}
          </div>
        );
      })}
      {table.indexes !== undefined && (
        <div
          style={{
            height: TABLE.foot,
            display: 'flex',
            alignItems: 'flex-end',
            margin: `0 ${String(TABLE.pad)}px`,
            fontSize: 11.5,
            color: C.muted,
            flex: 'none',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, height: 20 }}>
            <ListOrdered aria-hidden size={12} strokeWidth={2} />
            {table.indexes} {table.indexes === 1 ? 'index' : 'indexes'}
          </span>
        </div>
      )}
      {step !== undefined && <StepSticker state="current" n={step} />}
    </div>
  );
}

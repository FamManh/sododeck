import { AlignStartVertical, Ellipsis, Palette, Plus, Tag, Type } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

import type { Breakpoint } from '../../lib/landing/breakpoint';
import type { CardData } from '../../lib/landing/checkout-deck';
import { arrowHead, roundedPath, type Point } from '../../lib/landing/geometry';
import { C, FONT_MONO, HUES, pal } from '../../lib/landing/tokens';
import { DeckCard } from './deck/deck-card';
import { DeckChip } from './deck/deck-chip';
import { FloatingPanel } from './deck/floating-panel';
import { Viewport } from './deck/viewport';

const SHIPPING: CardData = {
  type: 'service',
  title: 'Shipping Service',
  description: 'Books the carrier',
  tags: ['eu', 'ops'],
  color: 'teal',
};
const TOPIC: CardData = { type: 'queue', typeName: 'Kafka topic', title: 'order.placed' };
const PROVIDER: CardData = {
  type: 'external',
  title: 'Payment Provider',
  description: 'Card acquirer, 3DS',
};

const microLabel: CSSProperties = {
  fontSize: 10.5,
  letterSpacing: '.07em',
  textTransform: 'uppercase',
  color: C.muted,
  fontWeight: 500,
};

const place = (key: string, x: number, y: number, zIndex: number, children: ReactNode) => (
  <div key={key} style={{ position: 'absolute', left: x, top: y, width: 184, zIndex }}>
    {children}
  </div>
);

const toolButton = (key: string, icon: ReactNode, filled = false) => (
  <span
    key={key}
    style={{
      width: 28,
      height: 28,
      borderRadius: 99,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: filled ? C.surface2 : 'transparent',
      color: C.inkSecondary,
    }}
  >
    {icon}
  </span>
);

const knob = (key: string, p: Point, active = false) => {
  const size = active ? 16 : 12;
  return (
    <span
      key={key}
      style={{
        position: 'absolute',
        left: p.x - size / 2,
        top: p.y - size / 2,
        width: size,
        height: size,
        borderRadius: 99,
        boxSizing: 'border-box',
        background: active ? C.primary : C.surface,
        border: `2px solid ${C.primary}`,
        boxShadow: active ? `0 0 0 4px ${C.primarySoft}` : 'none',
        zIndex: 7,
      }}
    />
  );
};

const tooltip = (text: string, style: CSSProperties) => (
  <span
    style={{
      position: 'absolute',
      background: C.inverse,
      color: C.onInverse,
      fontFamily: FONT_MONO,
      display: 'flex',
      alignItems: 'center',
      whiteSpace: 'nowrap',
      zIndex: 8,
      ...style,
    }}
  >
    {text}
  </span>
);

/** The hand-editing world (frame 96, 99, 129): quick edit, colours, guides, re-routing. */
function editWorld(narrow: boolean) {
  const ax = narrow ? 16 : 40;
  const start = narrow ? { x: 200, y: 330 } : { x: 224, y: 330 };
  const points: Point[] = narrow
    ? [start, { x: 318, y: 330 }, { x: 318, y: 420 }]
    : [start, { x: 352, y: 330 }, { x: 352, y: 410 }, { x: 440, y: 410 }];
  const d = roundedPath(points, 10);
  const end = points[points.length - 1] ?? start;
  return (
    <>
      {place(
        'shipping',
        ax,
        narrow ? 72 : 88,
        3,
        <DeckCard card={SHIPPING} state={{ selected: true, editing: true }} />,
      )}
      {place('topic', ax, 300, 2, <DeckCard card={TOPIC} />)}
      {place('provider', narrow ? 226 : 440, narrow ? 420 : 380, 2, <DeckCard card={PROVIDER} />)}
      <svg
        aria-hidden
        width={696}
        height={540}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          overflow: 'visible',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        <line
          x1={ax}
          y1={narrow ? 62 : 76}
          x2={ax}
          y2={420}
          stroke={C.primary}
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        <path
          d={d}
          fill="none"
          stroke={C.primary}
          strokeOpacity={0.18}
          strokeWidth={9}
          strokeLinecap="round"
        />
        <path d={d} fill="none" stroke={C.primary} strokeWidth={2.5} />
        <circle cx={start.x} cy={start.y} r={3.5} fill={C.primary} />
        <path
          d={arrowHead(end, narrow ? 't' : 'l')}
          stroke={C.primary}
          strokeWidth={2}
          fill={C.primary}
          strokeLinejoin="round"
        />
      </svg>
      {narrow
        ? [knob('a', { x: 318, y: 330 }), knob('b', { x: 259, y: 330 }, true)]
        : [
            knob('a', { x: 352, y: 330 }),
            knob('b', { x: 352, y: 410 }),
            knob('c', { x: 352, y: 370 }, true),
          ]}
      {tooltip('drag to re-route', {
        left: narrow ? 226 : 366,
        top: narrow ? 288 : 356,
        height: 24,
        padding: '0 9px',
        borderRadius: 8,
        fontSize: 11,
      })}
      {tooltip('aligned left · snap', {
        left: ax + 12,
        top: narrow ? 250 : 252,
        height: 22,
        padding: '0 8px',
        borderRadius: 99,
        fontSize: 10.5,
      })}
      <FloatingPanel
        style={{
          position: 'absolute',
          left: narrow ? 16 : 40,
          top: narrow ? 16 : 28,
          height: 42,
          padding: '0 6px',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          zIndex: 9,
        }}
      >
        {toolButton('type', <Type aria-hidden size={15} strokeWidth={2} />)}
        {toolButton('palette', <Palette aria-hidden size={15} strokeWidth={2} />, true)}
        {toolButton('tag', <Tag aria-hidden size={15} strokeWidth={2} />)}
        {toolButton('align', <AlignStartVertical aria-hidden size={15} strokeWidth={2} />)}
        <span style={{ width: 1, height: 20, background: C.hairline, margin: '0 3px' }} />
        {toolButton('more', <Ellipsis aria-hidden size={15} strokeWidth={2} />)}
      </FloatingPanel>
      <FloatingPanel
        style={{
          position: 'absolute',
          left: narrow ? 226 : 236,
          top: narrow ? 72 : 84,
          width: narrow ? 220 : 248,
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 9,
        }}
      >
        <span style={microLabel}>Card colour</span>
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(7,22px)', gap: narrow ? 6 : 10 }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 99,
              border: `1.5px dashed ${C.borderStrong}`,
              boxSizing: 'border-box',
            }}
          />
          {HUES.map((hue) => (
            <span
              key={hue}
              style={{
                width: 22,
                height: 22,
                borderRadius: 99,
                background: pal(hue, 'fill'),
                border: `1.5px solid ${pal(hue, 'stroke')}`,
                boxSizing: 'border-box',
                outline: hue === 'teal' ? `2px solid ${C.primary}` : 'none',
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
        <div style={{ height: 1, background: C.hairline, margin: '2px 0' }} />
        <span style={microLabel}>Tag colours</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <DeckChip label="eu" hue="blue" />
          <DeckChip label="ops" hue="slate" />
          <DeckChip label="critical" hue="red" />
          <DeckChip label="pci" hue="violet" />
          <span
            style={{
              height: 21,
              padding: '0 8px',
              borderRadius: 99,
              border: `1.5px dashed ${C.borderStrong}`,
              boxSizing: 'border-box',
              fontSize: 11.5,
              color: C.inkSecondary,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <Plus aria-hidden size={11} strokeWidth={2.25} />
            Tag
          </span>
        </div>
      </FloatingPanel>
    </>
  );
}

const LABEL =
  'Editing by hand: Shipping Service renamed in place and coloured teal from the colour popover, tag colours, a left alignment guide that snaps, and a connector re-routed by dragging its bend.';

/** Step 7 · Edit: "AI drafts it. You own it." */
export function EditVisual({ breakpoint }: { breakpoint: Breakpoint }) {
  if (breakpoint === 'phone') {
    return (
      <Viewport
        width="100%"
        height={410}
        scale={0.74}
        offsetX="calc(50% - 170.2px)"
        offsetY={4}
        worldWidth={460}
        worldHeight={540}
        label={LABEL}
      >
        {editWorld(true)}
      </Viewport>
    );
  }
  return (
    <Viewport
      width={breakpoint === 'desktop' ? 696 : '100%'}
      height={520}
      offsetX={breakpoint === 'desktop' ? 18 : 'calc(50% - 330px)'}
      offsetY={6}
      worldWidth={696}
      worldHeight={520}
      label={LABEL}
    >
      {editWorld(false)}
    </Viewport>
  );
}

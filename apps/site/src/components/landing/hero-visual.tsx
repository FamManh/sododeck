import { CircleCheck, ExternalLink, Loader, Play, SquareTerminal, Table } from 'lucide-react';
import {
  AGENT_PROMPT,
  ALL_EDGES,
  ALL_FRAMES,
  ALL_NODES,
  GENERATED_JSON,
  SEQUENCE,
  TABLES,
  WORLD,
} from '../../lib/landing/checkout-deck';
import type { Breakpoint } from '../../lib/landing/breakpoint';
import { animate, Timeline, withAnimation } from '../../lib/landing/timeline';
import { C, FONT_MONO, pal } from '../../lib/landing/tokens';
import { CodePane } from './deck/code-pane';
import { DeckScene } from './deck/deck-scene';
import { FloatingPanel } from './deck/floating-panel';
import { Viewport } from './deck/viewport';
import { Stage } from './stage';

/** Frame and overlay placement per breakpoint (design board `HC`). */
const LAYOUT = {
  desktop: {
    h: 540,
    s: 0.7,
    ox: 20,
    oy: 150,
    term: [32, 56, 420],
    code: [330, 138, 440, 330],
    pill: 24,
  },
  tablet: {
    h: 520,
    s: 0.64,
    ox: 20,
    oy: 150,
    term: [28, 48, 400],
    code: [300, 138, 410, 320],
    pill: 20,
  },
  phone: {
    h: 470,
    s: 0.69,
    ox: 8,
    oy: 104,
    term: [14, 20, 334],
    code: [14, 136, 334, 330],
    pill: 14,
  },
} as const;

const TABLE_NAMES = ['orders', 'order_items', 'payments'] as const;

/**
 * The hero's 10 s loop (L2): your agent types the prompt, `checkout.sododeck.json` streams in and
 * validates, then the deck deals in, Orders DB shows its tables and the Checkout flow plays. At
 * rest (no JS, reduced motion) it is the last frame: the deck with the flow complete.
 */
export function HeroVisual({ breakpoint }: { breakpoint: Breakpoint }) {
  const layout = LAYOUT[breakpoint];
  const phone = breakpoint === 'phone';
  const tl = new Timeline(10, true);
  const nodes = phone ? ALL_NODES.slice(0, 4) : ALL_NODES;
  const edges = phone ? ALL_EDGES.slice(0, 3) : ALL_EDGES;
  const frames = phone ? ALL_FRAMES.slice(0, 2) : ALL_FRAMES;

  const peek = (
    <div
      {...withAnimation(
        { position: 'absolute', left: 300, top: 374, width: 184, zIndex: 4 },
        animate(tl, [
          [6.1, { opacity: 0, transform: 'translateY(-6px)' }],
          [6.4, { opacity: 1, transform: 'none' }],
        ]),
      )}
    >
      <div style={{ width: 2, height: 22, background: C.borderStrong, marginLeft: 91 }} />
      <FloatingPanel style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{
            fontSize: 10.5,
            letterSpacing: '.07em',
            textTransform: 'uppercase',
            color: C.muted,
            fontWeight: 500,
            padding: '2px 6px 4px',
          }}
        >
          Inside · 3 tables
        </span>
        {TABLE_NAMES.map((name) => (
          <div
            key={name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              height: 24,
              padding: '0 6px',
              borderRadius: 8,
            }}
          >
            <Table aria-hidden size={13} strokeWidth={2} color={C.inkSecondary} />
            <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, flex: 1 }}>{name}</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.muted }}>
              {TABLES[name].columns.length}
            </span>
          </div>
        ))}
      </FloatingPanel>
    </div>
  );

  const [tx, ty, tw] = layout.term;
  const typed = (text: string, a: number, b: number) => (
    <span
      {...withAnimation(
        {
          display: 'inline-block',
          verticalAlign: 'top',
          overflow: 'hidden',
          whiteSpace: 'pre',
          width: `${String(text.length)}ch`,
        },
        animate(tl, [
          [a, { width: '0ch' }, `steps(${String(text.length)},end)`],
          [b, { width: `${String(text.length)}ch` }],
        ]),
      )}
    >
      {text}
    </span>
  );
  const terminal = (
    <FloatingPanel
      {...withAnimation(
        {
          position: 'absolute',
          left: tx,
          top: ty,
          width: tw,
          padding: 0,
          overflow: 'hidden',
          zIndex: 10,
          opacity: 0,
        },
        animate(tl, [
          [0, { opacity: 1, transform: 'none' }],
          [4.7, { opacity: 1, transform: 'none' }],
          [5.1, { opacity: 0, transform: 'scale(.96)' }],
        ]),
      )}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 40,
          padding: '0 14px',
          borderBottom: `1px solid ${C.hairline}`,
        }}
      >
        <SquareTerminal aria-hidden size={15} strokeWidth={2} color={C.inkSecondary} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>Your agent</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted }}>sododeck skill</span>
      </div>
      <div
        style={{
          padding: '12px 14px 14px',
          fontFamily: FONT_MONO,
          fontSize: 12,
          lineHeight: '20px',
          color: C.ink,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {AGENT_PROMPT.map((text, i) => (
          <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 20 }}>
            <span style={{ color: C.muted, width: '2ch', flex: 'none' }}>{i === 0 ? '›' : ''}</span>
            {typed(text, 0.2 + i * 0.78, 0.95 + i * 0.78)}
          </div>
        ))}
        <div
          {...withAnimation(
            {
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 20,
              marginTop: 8,
              color: C.inkSecondary,
            },
            animate(tl, [
              [2.6, { opacity: 0 }],
              [2.8, { opacity: 1 }],
            ]),
          )}
        >
          <Loader aria-hidden size={13} strokeWidth={2} color={C.muted} />
          Writing checkout.sododeck.json
        </div>
        <div
          {...withAnimation(
            { display: 'flex', alignItems: 'center', gap: 6, minHeight: 20, color: C.inkSecondary },
            animate(tl, [
              [4.15, { opacity: 0 }],
              [4.35, { opacity: 1 }],
            ]),
          )}
        >
          <CircleCheck aria-hidden size={13} strokeWidth={2.25} color={pal('green', 'dot')} />
          validate · 0 problems
        </div>
        <div
          {...withAnimation(
            { display: 'flex', alignItems: 'center', gap: 6, minHeight: 20, color: C.inkSecondary },
            animate(tl, [
              [4.45, { opacity: 0 }],
              [4.6, { opacity: 1 }],
            ]),
          )}
        >
          <ExternalLink aria-hidden size={13} strokeWidth={2} color={C.muted} />
          Opening in Sododeck
        </div>
      </div>
    </FloatingPanel>
  );

  const [cx, cy, cw, ch] = layout.code;
  const code = (
    <div
      {...withAnimation(
        { position: 'absolute', left: cx, top: cy, zIndex: 11, opacity: 0 },
        animate(tl, [
          [2.7, { opacity: 0, transform: 'translateY(10px)' }],
          [3.0, { opacity: 1, transform: 'none' }],
          [4.7, { opacity: 1, transform: 'none' }],
          [5.1, { opacity: 0, transform: 'scale(.96)' }],
        ]),
      )}
    >
      <CodePane
        id={`hero-code-${breakpoint}`}
        width={cw}
        height={ch}
        panels={[
          {
            tab: 'JSON',
            lines: GENERATED_JSON,
            foot: false,
            lineMotion: (i) =>
              animate(tl, [
                [2.9 + i * 0.09, { opacity: 0 }],
                [3.0 + i * 0.09, { opacity: 1 }],
              ]),
          },
        ]}
        chip={
          <span
            {...withAnimation(
              {
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 24,
                padding: '0 9px',
                borderRadius: 99,
                background: pal('green', 'chip'),
                color: pal('green', 'ink'),
                fontSize: 12,
                fontWeight: 600,
              },
              animate(tl, [
                [4.1, { opacity: 0, transform: 'scale(.8)' }],
                [4.3, { opacity: 1, transform: 'none' }],
              ]),
            )}
          >
            <CircleCheck aria-hidden size={13} strokeWidth={2.25} />
            valid
          </span>
        }
      />
    </div>
  );

  const pills = (
    <div
      {...withAnimation(
        {
          position: 'absolute',
          left: layout.pill,
          top: layout.pill,
          right: 20,
          zIndex: 9,
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
        },
        animate(tl, [
          [0, { opacity: 0 }],
          [5.0, { opacity: 0 }],
          [5.3, { opacity: 1 }],
          [9.5, { opacity: 1 }],
          [10, { opacity: 0 }],
        ]),
      )}
    >
      <span
        style={{
          height: 32,
          padding: '0 12px',
          borderRadius: 99,
          background: C.surface,
          border: `1.5px solid ${C.borderStrong}`,
          boxShadow: `0 2px 0 0 ${C.borderStrong}`,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          fontSize: 12.5,
          whiteSpace: 'nowrap',
        }}
      >
        <CircleCheck aria-hidden size={14} strokeWidth={2.25} color={pal('green', 'dot')} />
        <span style={{ fontFamily: FONT_MONO, fontSize: 11.5 }}>checkout.sododeck.json</span>
        {!phone && <span style={{ color: C.inkSecondary }}>· valid · laid out</span>}
      </span>
      <span
        style={{
          height: 32,
          padding: '0 12px',
          borderRadius: 99,
          background: C.primarySoft,
          border: `1.5px solid ${C.primary}`,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          fontSize: 12.5,
          fontWeight: 600,
          color: C.primaryInk,
          whiteSpace: 'nowrap',
        }}
      >
        <Play aria-hidden size={13} strokeWidth={2.5} />
        Flow · Checkout
      </span>
    </div>
  );

  // The whole deck fades out in the last half second, so the loop restarts on an empty canvas.
  const endFade = animate(tl, [
    [0, { opacity: 1 }],
    [9.5, { opacity: 1 }],
    [10, { opacity: 0 }],
  ]);

  return (
    <Stage timeline={tl}>
      <Viewport
        width="100%"
        height={layout.h}
        scale={layout.s}
        offsetX={layout.ox}
        offsetY={layout.oy}
        worldWidth={WORLD.w}
        worldHeight={WORLD.h}
        bleed
        label="The Checkout deck your agent generated, open in Sododeck: services in groups, Orders DB with three tables inside, and the Checkout flow played to its last step."
        {...(endFade.style === undefined ? {} : { worldStyle: endFade.style })}
        worldClassName={endFade.className}
        over={
          <>
            {terminal}
            {code}
            {pills}
          </>
        }
      >
        <DeckScene
          nodes={nodes}
          edges={edges}
          frames={frames}
          width={WORLD.w}
          height={WORLD.h}
          timeline={tl}
          flow={{
            start: { node: 'web', n: 1 },
            hops: phone ? SEQUENCE.slice(0, 3) : SEQUENCE,
            t0: 6.6,
            step: phone ? 0.6 : 0.36,
          }}
          nodeMotion={(_, i) =>
            animate(tl, [
              [5.1 + i * 0.09, { opacity: 0, transform: 'translateY(-18px) rotate(-3deg)' }],
              [5.5 + i * 0.09, { opacity: 1, transform: 'none' }],
            ])
          }
          frameMotion={(i) =>
            animate(tl, [
              [4.9 + i * 0.07, { opacity: 0 }],
              [5.3 + i * 0.07, { opacity: 1 }],
            ])
          }
          edgeMotion={(_, i) =>
            animate(tl, [
              [5.9 + i * 0.05, { opacity: 0 }],
              [6.2 + i * 0.05, { opacity: 1 }],
            ])
          }
        >
          {peek}
        </DeckScene>
      </Viewport>
    </Stage>
  );
}

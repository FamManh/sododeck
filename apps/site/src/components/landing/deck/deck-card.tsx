import { Layers } from 'lucide-react';
import type { CSSProperties } from 'react';

import type { CardData } from '../../../lib/landing/checkout-deck';
import { cardHeight, DECK } from '../../../lib/landing/geometry';
import { C, pal, type Hue } from '../../../lib/landing/tokens';
import { DeckChip } from './deck-chip';
import { KeyCap } from './key-cap';
import { StepSticker } from './step-sticker';
import { TYPE_STYLE } from './type-style';

/** Tag colours of the sample deck (033). */
const TAG_HUE: Record<string, Hue> = { critical: 'red', pci: 'violet', eu: 'blue', ops: 'slate' };

export type CardZoom = 'component' | 'container' | 'landscape';

export interface CardState {
  selected?: boolean;
  dim?: boolean;
  /** The title is being edited: its last word is selected, with a caret. */
  editing?: boolean;
  step?: { state: 'played' | 'current'; n: number };
}

interface DeckCardProps {
  card: CardData;
  zoom?: CardZoom;
  state?: CardState;
}

const clamp = (lines: number): CSSProperties => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

function EditedTitle({ title }: { title: string }) {
  const cut = title.lastIndexOf(' ');
  return (
    <>
      {title.slice(0, cut + 1)}
      <span style={{ background: C.textSelection }}>{title.slice(cut + 1)}</span>
      <span
        style={{
          display: 'inline-block',
          width: 1.5,
          height: '1.05em',
          background: C.primary,
          verticalAlign: '-.15em',
          marginLeft: 1,
        }}
      />
    </>
  );
}

/**
 * A Deck card (DESIGN.md "Card system (Deck)", frames 117–123): thick paper with a lip in its
 * stroke colour, a type tile, the title, a description, and at component zoom its fields and tags.
 */
export function DeckCard({ card, zoom = 'component', state = {} }: DeckCardProps) {
  const type = TYPE_STYLE[card.type];
  const Icon = type.icon;
  const hue = card.color;
  const current = state.step?.state === 'current';
  const fill = hue === undefined ? C.surface : pal(hue, 'fill');
  const stroke = current ? C.primary : hue === undefined ? C.borderStrong : pal(hue, 'stroke');
  const root: CSSProperties = {
    position: 'relative',
    width: DECK.width,
    boxSizing: 'border-box',
    background: fill,
    border: `${String(DECK.border)}px solid ${stroke}`,
    borderRadius: DECK.radius,
    boxShadow: `0 ${String(current ? 5 : DECK.lip)}px 0 0 ${stroke}`,
    transform: current ? 'translateY(-2px)' : undefined,
    outline: state.selected === true ? `2px solid ${C.primary}` : undefined,
    outlineOffset: 2,
    opacity: state.dim === true ? 0.22 : 1,
    color: C.ink,
    display: 'flex',
    flexDirection: 'column',
    textAlign: 'left',
  };
  if (zoom !== 'component') {
    root.height = cardHeight({
      title: card.title,
      ...(card.description === undefined ? {} : { description: card.description }),
      inside: card.inside !== undefined,
    });
  }
  const sticker = state.step === undefined ? null : <StepSticker {...state.step} />;

  if (zoom === 'landscape') {
    return (
      <div
        style={{
          ...root,
          alignItems: 'center',
          justifyContent: 'center',
          background: hue === undefined ? C.surface2 : pal(hue, 'fill'),
        }}
      >
        <Icon
          aria-hidden
          size={30}
          strokeWidth={1.5}
          color={hue === undefined ? C.inkSecondary : pal(hue, 'ink')}
        />
        {sticker}
      </div>
    );
  }

  const persons = (card.fields ?? []).filter((f) => f.person === true);
  const rows = (card.fields ?? []).filter((f) => f.person !== true);
  const showDetails = zoom === 'component';
  return (
    <div
      style={{ ...root, gap: DECK.gap, padding: `${String(DECK.pad)}px ${String(DECK.pad + 1)}px` }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 24, minWidth: 0 }}>
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 8,
            background: hue === undefined ? C.surface2 : pal(hue, 'chip'),
            color: hue === undefined ? C.inkSecondary : pal(hue, 'ink'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          <Icon aria-hidden size={14} strokeWidth={2} />
        </span>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 500,
            color: hue === undefined ? C.muted : C.inkSecondary,
            flex: 1,
            minWidth: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {card.typeName ?? type.name}
        </span>
      </div>
      <div
        style={{
          fontSize: DECK.titleSize,
          fontWeight: 600,
          lineHeight: DECK.titleLine,
          overflowWrap: 'break-word',
          ...clamp(3),
        }}
      >
        {state.editing === true ? <EditedTitle title={card.title} /> : card.title}
      </div>
      {card.description !== undefined && (
        <div
          style={{
            fontSize: DECK.descSize,
            lineHeight: DECK.descLine,
            color: C.inkSecondary,
            textWrap: 'pretty',
            ...clamp(3),
          }}
        >
          {card.description}
        </div>
      )}
      {showDetails && (persons.length > 0 || rows.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {persons.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {persons.map((f) => (
                <DeckChip
                  key={f.label}
                  label={f.value}
                  icon={
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        background: C.surface3,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 7.5,
                        fontWeight: 600,
                        color: C.inkSecondary,
                        marginLeft: -4,
                      }}
                    >
                      {initials(f.value)}
                    </span>
                  }
                />
              ))}
            </div>
          )}
          {rows.map((f) => (
            <div
              key={f.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                minHeight: 19,
              }}
            >
              <span
                style={{
                  fontSize: 11.5,
                  color: hue === undefined ? C.muted : C.inkSecondary,
                  whiteSpace: 'nowrap',
                }}
              >
                {f.label}
              </span>
              <span style={{ fontSize: 12, color: C.ink, whiteSpace: 'nowrap' }}>{f.value}</span>
            </div>
          ))}
        </div>
      )}
      {showDetails && card.tags !== undefined && card.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {card.tags.map((tag) => (
            <DeckChip key={tag} label={tag} hue={TAG_HUE[tag] ?? 'slate'} small />
          ))}
        </div>
      )}
      {card.inside !== undefined && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            height: 24,
            padding: '0 4px 0 8px',
            borderRadius: 999,
            background: C.surface2,
            fontSize: 11.5,
            fontWeight: 500,
            color: C.ink,
          }}
        >
          <Layers aria-hidden size={13} strokeWidth={2} color={C.inkSecondary} />
          {card.inside} inside
          <span style={{ flex: 1 }} />
          <KeyCap label="⏎" />
        </div>
      )}
      {sticker}
    </div>
  );
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  const first = words[0] ?? '';
  const second = words[1];
  return (
    second === undefined ? first.slice(0, 2) : `${first.charAt(0)}${second.charAt(0)}`
  ).toUpperCase();
}

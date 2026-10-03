import { Archive, Braces, Database, Download, FileCode, Image, PenTool, Plus } from 'lucide-react';

import { C, FONT_MONO } from '../../lib/landing/tokens';
import { DeckThumbnail } from './deck-thumbnail';
import { IconTile } from './icon-tile';

const FORMATS = [
  ['JSON', Braces],
  ['PNG', Image],
  ['SVG', PenTool],
  ['SQL', Database],
  ['DBML', FileCode],
] as const;

/**
 * Step 8 · Own your file: the deck library in this browser, the backup reminder and the export
 * formats. One layout for every width: it reflows with CSS.
 */
export function LocalVisual() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 tab:flex-row">
        <DeckThumbnail title="Checkout" meta="8 cards · 1 flow · edited today" scale={0.18} />
        <div className="hidden min-w-0 flex-1 tab:flex">
          <DeckThumbnail
            title="Checkout · before refactor"
            meta="8 cards · 1 flow · edited 12 Sep"
            scale={0.18}
          />
        </div>
        <div className="flex min-h-[84px] items-center justify-center gap-2.5 rounded-deck-card border-[1.5px] border-dashed border-border-strong p-4 tab:min-h-[209px] tab:min-w-0 tab:flex-1 tab:flex-col">
          <IconTile icon={Plus} />
          <div className="flex flex-col gap-0.5 tab:items-center">
            <span className="text-[14px] font-semibold text-ink">New deck</span>
            <span className="text-[12px] text-ink-muted">or import JSON, SQL or DBML</span>
          </div>
        </div>
      </div>
      <p
        className="flex flex-wrap items-center gap-2.5 rounded-banner px-3.5 py-3 text-[13.5px]"
        style={{ background: C.amberSoft, color: C.amberInk }}
      >
        <Archive aria-hidden size={16} strokeWidth={2} className="flex-none" />
        <span className="min-w-[200px] flex-1">
          Decks live only in this browser. Export a backup now and then.
        </span>
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Download aria-hidden size={14} strokeWidth={2.25} />
          Export backup
        </span>
      </p>
      <div className="flex flex-col gap-2.5">
        <span className="text-[10.5px] font-medium tracking-[.07em] text-ink-muted uppercase">
          Export
        </span>
        <ul className="flex flex-wrap gap-2" aria-label="Export formats">
          {FORMATS.map(([name, Icon]) => (
            <li
              key={name}
              className="inline-flex h-[34px] items-center gap-[7px] rounded-full border-[1.5px] border-border-strong bg-surface pr-[13px] pl-[11px] text-[12.5px] font-medium text-ink"
              style={{ boxShadow: `0 2px 0 0 ${C.borderStrong}`, fontFamily: FONT_MONO }}
            >
              <Icon aria-hidden size={14} strokeWidth={2} color={C.inkSecondary} />
              {name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

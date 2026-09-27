import { KindTile } from '@sododeck/ui/components/kind-tile';
import {
  COMPONENT_KINDS,
  ICON_STROKE_WIDTH,
  KIND_STYLE,
  MATERIAL_TO_LUCIDE,
} from '@sododeck/ui/lib/icons';

import { GallerySection } from './gallery-section';
import { SampleRow } from './sample-row';

const SIZES = [22, 28, 30, 40] as const;

export function KindsSection() {
  return (
    <GallerySection
      id="kinds"
      title="Kind tiles and icons"
      description="Six component kinds at 22 / 28 / 30 / 40 px, plus the Material → lucide mapping (docs/design/icon-mapping.md). Reference: 14-editor-palette-tab."
    >
      {COMPONENT_KINDS.map((kind) => (
        <SampleRow key={kind} label={KIND_STYLE[kind].label}>
          {SIZES.map((size) => (
            <KindTile key={size} kind={kind} size={size} />
          ))}
        </SampleRow>
      ))}
      <SampleRow label="Unknown">
        {SIZES.map((size) => (
          <KindTile key={size} kind="mainframe" size={size} />
        ))}
      </SampleRow>
      <SampleRow label="Palette tiles">
        <div className="grid w-full max-w-md grid-cols-2 gap-2">
          {COMPONENT_KINDS.map((kind) => (
            <div
              key={kind}
              className="flex items-center gap-2.5 rounded-card border border-border bg-surface p-2.5"
            >
              <KindTile kind={kind} size={28} decorative />
              <span className="text-body font-medium">{KIND_STYLE[kind].label}</span>
            </div>
          ))}
        </div>
      </SampleRow>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
        {Object.entries(MATERIAL_TO_LUCIDE).map(([glyph, { icon: Icon, substitute }]) => (
          <li
            key={glyph}
            className="flex items-center gap-2 rounded-row px-2 py-1.5 text-caption text-ink-secondary hover:bg-surface-2"
          >
            <Icon
              aria-hidden
              className="size-4.5 shrink-0 text-ink"
              strokeWidth={ICON_STROKE_WIDTH}
            />
            <span className="truncate font-mono">{glyph}</span>
            {substitute && <span className="ml-auto text-ink-muted">≈</span>}
          </li>
        ))}
      </ul>
    </GallerySection>
  );
}

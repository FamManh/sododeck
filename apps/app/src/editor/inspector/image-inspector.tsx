import type { Image, SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { PanelSection } from '@sododeck/ui/components/panel';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { Image as ImageIcon, Trash2 } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import { formatBytes } from '../export/export-file-name';
import { FieldLabel } from '../fields/field-label';
import { ImageTextField } from '../images/image-text-field';
import { InspectorFrame } from './inspector-frame';

const TYPE_NAMES: Record<string, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/webp': 'WebP',
  'image/gif': 'GIF',
  'image/svg+xml': 'SVG',
  'image/avif': 'AVIF',
};

/** A read-only fact of the picture: label and value, selectable text. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <span className="truncate text-body-sm text-ink" title={value}>
        {value}
      </span>
    </div>
  );
}

/**
 * The inspector of one image (055): alt text and caption, then what the file is. "Replace
 * picture" is not offered (out of scope).
 */
export function ImageInspector({ deck, image }: { deck: SododeckFile; image: Image }) {
  const facts = deck.assets?.[image.asset];
  const locked = image.locked === true;
  const heading = image.alt ?? facts?.name ?? 'Image';
  return (
    <InspectorFrame
      icon={<ImageIcon aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-5" />}
      heading={heading}
      subtitle={facts === undefined ? 'Image · picture missing' : `Image · ${facts.name}`}
      actions={
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete image"
          disabled={locked}
          title={locked ? 'Locked · unlock to delete' : undefined}
          onClick={() => {
            useUiStore.getState().requestDelete({ images: [image.id] });
          }}
        >
          <Trash2 />
        </Button>
      }
    >
      <div key={image.id} className="contents">
        <PanelSection>
          <ImageTextField imageId={image.id} field="alt" />
          <ImageTextField imageId={image.id} field="caption" />
        </PanelSection>
        <PanelSection>
          <Fact label="File name" value={facts?.name ?? 'Unknown'} />
          <Fact
            label="Type"
            value={facts === undefined ? 'Unknown' : (TYPE_NAMES[facts.type] ?? facts.type)}
          />
          <Fact
            label="Stored size"
            value={facts === undefined ? 'Unknown' : formatBytes(facts.bytes)}
          />
          <Fact
            label="Pixel size"
            value={
              facts === undefined ? 'Unknown' : `${String(facts.width)} × ${String(facts.height)}`
            }
          />
        </PanelSection>
      </div>
    </InspectorFrame>
  );
}

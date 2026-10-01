/**
 * The Appearance section (020 T034, contract "Detail drawer: Appearance section"): a `PanelSection`
 * with two rows, "Fill: <name|none>" and "Stroke: <name|none>", each opening `StylePicker` in its
 * own `Popover` with that channel preselected. Shared by the component, bulk and group inspectors.
 */
import type { ColorRef } from '@sododeck/schema';
import { Popover, PopoverContent, PopoverTrigger } from '@sododeck/ui/components/popover';
import { PanelSection } from '@sododeck/ui/components/panel';
import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import { useState } from 'react';

import { useUiStore } from '../../state/ui-store';
import type { Shared } from './derive';
import { colourName } from '../style/card-style';
import { StylePicker, type StylePickerValue } from '../style/style-picker';

function channelLabel(channel: 'fill' | 'stroke', value: Shared<ColorRef | null>): string {
  const name = channel === 'fill' ? 'Fill' : 'Stroke';
  const text = value.mixed ? 'Mixed' : value.value === null ? 'none' : colourName(value.value);
  return `${name}: ${text}`;
}

function AppearanceRow({
  channel,
  value,
  deckColours,
  onApply,
  onAddColour,
  onRemoveColour,
  skipped,
}: {
  channel: 'fill' | 'stroke';
  value: StylePickerValue;
  deckColours?: readonly { hex: string }[];
  onApply: (channel: 'fill' | 'stroke', value: ColorRef | null) => void;
  onAddColour?: (channel: 'fill' | 'stroke', hex: string) => void;
  onRemoveColour?: (hex: string) => void;
  skipped?: { colored: number; total: number };
}) {
  const [open, setOpen] = useState(false);
  const setTab = useUiStore((s) => s.setStylePickerTab);
  const setStylePreview = useUiStore((s) => s.setStylePreview);
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // This popover isn't tied to `toolbarField` (020 T048), so its own close must clear the
        // preview: the toolbar's does this already via `closeToolbarField`.
        if (!next) setStylePreview(null);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => {
            setTab(channel);
          }}
          className={cn(
            'flex h-8 items-center justify-between rounded-row px-2 text-body-sm text-ink hover:bg-surface-2',
            focusRing,
          )}
        >
          {channelLabel(channel, value[channel])}
        </button>
      </PopoverTrigger>
      <PopoverContent aria-label="Colour" align="start" className="w-[272px] shadow-menu">
        <StylePicker
          value={value}
          onApply={onApply}
          skipped={skipped}
          deckColours={deckColours}
          onPreview={(previewChannel, hex) => {
            setStylePreview(hex === null ? null : { channel: previewChannel, value: hex });
          }}
          onAddColour={(addChannel, hex) => {
            onAddColour?.(addChannel, hex);
            setStylePreview(null);
          }}
          onRemoveColour={onRemoveColour}
        />
      </PopoverContent>
    </Popover>
  );
}

export function AppearanceSection({
  value,
  deckColours,
  onApply,
  onAddColour,
  onRemoveColour,
  skipped,
}: {
  value: StylePickerValue;
  deckColours?: readonly { hex: string }[];
  onApply: (channel: 'fill' | 'stroke', value: ColorRef | null) => void;
  onAddColour?: (channel: 'fill' | 'stroke', hex: string) => void;
  onRemoveColour?: (hex: string) => void;
  /** Selected items that can't be coloured (bulk selections, 020 T037/T038). */
  skipped?: { colored: number; total: number };
}) {
  return (
    <PanelSection label="Appearance">
      <div className="flex flex-col">
        <AppearanceRow
          channel="fill"
          value={value}
          deckColours={deckColours}
          onApply={onApply}
          onAddColour={onAddColour}
          onRemoveColour={onRemoveColour}
          skipped={skipped}
        />
        <AppearanceRow
          channel="stroke"
          value={value}
          deckColours={deckColours}
          onApply={onApply}
          onAddColour={onAddColour}
          onRemoveColour={onRemoveColour}
          skipped={skipped}
        />
      </div>
    </PanelSection>
  );
}

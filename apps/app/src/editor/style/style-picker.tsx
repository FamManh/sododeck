/**
 * The style picker (020 T029, contract "Picker (StylePopover, dialog)"): pure content, rendered
 * inside a `Popover`/`PopoverContent` (the toolbar field popover or the Appearance section), so it
 * owns no dialog role of its own. The active tab lives in the UI store (`stylePickerTab`) so the
 * toolbar and the inspector share it.
 */
import type { CardColor, ColorRef } from '@sododeck/schema';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import { Swatch, SwatchGrid } from '@sododeck/ui/components/swatch-grid';
import { Ban } from 'lucide-react';
import { useState } from 'react';

import type { Shared } from '../inspector/derive';
import { useUiStore } from '../../state/ui-store';
import { CARD_COLORS, colourName, isNamedColor } from './card-style';

export interface StylePickerValue {
  fill: Shared<ColorRef | null>;
  stroke: Shared<ColorRef | null>;
}

export interface StylePickerProps {
  value: StylePickerValue;
  onApply: (channel: 'fill' | 'stroke', value: ColorRef | null) => void;
  /** Custom deck colours (020 US3): the grid and "Add a deck colour" render there. */
  deckColours?: readonly { hex: string }[];
}

export function StylePicker({ value, onApply }: StylePickerProps) {
  const tab = useUiStore((s) => s.stylePickerTab);
  const setTab = useUiStore((s) => s.setStylePickerTab);
  const [hovered, setHovered] = useState<string | null>(null);

  const channel = value[tab];
  const checked = !channel.mixed && channel.value !== null ? channel.value : null;
  const checkedNamed = checked !== null && isNamedColor(checked) ? checked : null;

  const options = CARD_COLORS.map((colour) => ({
    value: colour,
    label: colourName(colour),
    swatch: `var(--color-card-${colour}-${tab})`,
  }));

  const activeName = (hovered ?? checkedNamed) as CardColor | null;
  const footer =
    activeName !== null
      ? `${colourName(activeName)} · card-${activeName}-${tab}`
      : channel.mixed
        ? 'Mixed'
        : 'No colour';

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        aria-label="Colour target"
        value={tab}
        onValueChange={(next) => {
          setTab(next as 'fill' | 'stroke');
        }}
      >
        <SegmentedControlItem value="fill">Fill</SegmentedControlItem>
        <SegmentedControlItem value="stroke">Stroke</SegmentedControlItem>
      </SegmentedControl>
      <button
        type="button"
        aria-pressed={!channel.mixed && channel.value === null}
        onClick={() => {
          onApply(tab, null);
        }}
        className="flex h-8 items-center gap-2 rounded-button px-2 text-body-sm text-ink hover:bg-surface-2"
      >
        <Ban aria-hidden size={16} strokeWidth={1.5} />
        <Swatch swatch="var(--color-border)" className="size-4" />
        No colour
      </button>
      <SwatchGrid
        label="Colours"
        options={options}
        value={checkedNamed}
        columns={7}
        onSelect={(next) => {
          onApply(tab, next);
        }}
        onHoverChange={setHovered}
      />
      <p role="status" className="text-body-sm text-ink-secondary">
        {footer}
      </p>
    </div>
  );
}

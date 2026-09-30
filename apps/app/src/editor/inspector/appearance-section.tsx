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
  onApply,
  skipped,
}: {
  channel: 'fill' | 'stroke';
  value: StylePickerValue;
  onApply: (channel: 'fill' | 'stroke', value: ColorRef | null) => void;
  skipped?: { colored: number; total: number };
}) {
  const [open, setOpen] = useState(false);
  const setTab = useUiStore((s) => s.setStylePickerTab);
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
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
        <StylePicker value={value} onApply={onApply} skipped={skipped} />
      </PopoverContent>
    </Popover>
  );
}

export function AppearanceSection({
  value,
  onApply,
  skipped,
}: {
  value: StylePickerValue;
  onApply: (channel: 'fill' | 'stroke', value: ColorRef | null) => void;
  /** Selected items that can't be coloured (bulk selections, 020 T037/T038). */
  skipped?: { colored: number; total: number };
}) {
  return (
    <PanelSection label="Appearance">
      <div className="flex flex-col">
        <AppearanceRow channel="fill" value={value} onApply={onApply} skipped={skipped} />
        <AppearanceRow channel="stroke" value={value} onApply={onApply} skipped={skipped} />
      </div>
    </PanelSection>
  );
}

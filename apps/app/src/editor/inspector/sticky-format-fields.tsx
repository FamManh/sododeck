import { STICKY_DEFAULT_SIZE, STICKY_MIN_SIZE } from '@sododeck/model';
import type { Sticky } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { PanelSection } from '@sododeck/ui/components/panel';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import { Switch } from '@sododeck/ui/components/switch';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import { useId } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { FieldLabel } from '../fields/field-label';
import { oneStep } from '../fields/one-step';
import { FIXED_FONT_SIZES } from '../stickies/fit-font-size';
import { STICKY_SIZE_LIMITS } from '../editing/sticky-resize';
import { SizeField } from './size-fields';

type Align = 'left' | 'center' | 'right';

const AUTO = 'auto';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(value)));

const ALIGNS: readonly { value: Align; label: string; Icon: typeof AlignLeft }[] = [
  { value: 'left', label: 'Align left', Icon: AlignLeft },
  { value: 'center', label: 'Align centre', Icon: AlignCenter },
  { value: 'right', label: 'Align right', Icon: AlignRight },
];

const SIZE_FIELDS = [
  { key: 'width', label: 'Width' },
  { key: 'height', label: 'Height' },
] as const;

/**
 * A note's size, text size, alignment and lock (053): the keyboard path to what the handles and
 * the toolbar do. Each change is one undo step. An unset size reads as the default; Auto text
 * size is no stored value, and centred text is the default alignment, so neither is written.
 */
export function StickyFormatFields({ sticky, disabled }: { sticky: Sticky; disabled: boolean }) {
  const editor = useEditor();
  const announce = useUiStore((state) => state.announce);
  const id = useId();
  const size = sticky.size ?? STICKY_DEFAULT_SIZE;
  const locked = sticky.locked === true;
  const align: Align = sticky.align ?? 'center';

  return (
    <>
      <PanelSection label="Size">
        <div className="flex items-end gap-2">
          <div className="grid flex-1 grid-cols-2 gap-2">
            {SIZE_FIELDS.map(({ key, label }) => (
              <SizeField
                key={key}
                id={`${id}-${key}`}
                label={label}
                value={size[key]}
                // A locked note refuses a resize: unlock first.
                disabled={disabled || locked}
                onCommit={(value) => {
                  const next = {
                    ...size,
                    [key]: clamp(value, STICKY_MIN_SIZE[key], STICKY_SIZE_LIMITS.max[key]),
                  };
                  oneStep(editor, () => {
                    editor.setStickySize(sticky.id, next);
                  });
                }}
              />
            ))}
          </div>
          <Button
            variant="ghost"
            disabled={disabled || locked || sticky.size === undefined}
            onClick={() => {
              oneStep(editor, () => {
                editor.setStickySize(sticky.id, null);
              });
              announce('Size reset');
            }}
          >
            Reset size
          </Button>
        </div>
      </PanelSection>
      <PanelSection>
        <FieldLabel id={`${id}-font`}>Text size</FieldLabel>
        <SegmentedControl
          aria-labelledby={`${id}-font`}
          value={sticky.fontSize === undefined ? AUTO : String(sticky.fontSize)}
          disabled={disabled}
          onValueChange={(value) => {
            const fixed = FIXED_FONT_SIZES.find((candidate) => String(candidate) === value);
            oneStep(editor, () => {
              editor.setStickyFont([sticky.id], fixed ?? null);
            });
            announce(fixed === undefined ? 'Text size automatic' : `Text size ${String(fixed)}`);
          }}
          className="self-start"
        >
          <SegmentedControlItem value={AUTO}>Auto</SegmentedControlItem>
          {FIXED_FONT_SIZES.map((candidate) => (
            <SegmentedControlItem key={candidate} value={String(candidate)}>
              {String(candidate)}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </PanelSection>
      <PanelSection>
        <FieldLabel id={`${id}-align`}>Alignment</FieldLabel>
        <SegmentedControl
          aria-labelledby={`${id}-align`}
          value={align}
          disabled={disabled}
          onValueChange={(value) => {
            const next = ALIGNS.find((candidate) => candidate.value === value);
            if (next === undefined) return;
            oneStep(editor, () => {
              editor.setStickyAlign([sticky.id], next.value === 'center' ? null : next.value);
            });
            announce(next.label);
          }}
          className="self-start"
        >
          {ALIGNS.map(({ value, label, Icon }) => (
            <SegmentedControlItem key={value} value={value} aria-label={label}>
              <Icon aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </PanelSection>
      <PanelSection>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <label htmlFor={`${id}-lock`} className="text-body text-ink">
              Lock
            </label>
            <span id={`${id}-lock-description`} className="text-caption text-ink-secondary">
              A locked note can't be moved, resized or deleted
            </span>
          </div>
          <Switch
            id={`${id}-lock`}
            checked={locked}
            disabled={disabled}
            aria-describedby={`${id}-lock-description`}
            aria-label="Lock"
            onCheckedChange={(checked) => {
              oneStep(editor, () => {
                editor.setLocked([sticky.id], checked, 'stickies');
              });
              announce(checked ? 'Note locked' : 'Note unlocked');
            }}
          />
        </div>
      </PanelSection>
    </>
  );
}

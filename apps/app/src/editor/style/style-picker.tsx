/**
 * The style picker (020 T029/T047, contract "Picker (StylePopover, dialog)"): pure content,
 * rendered inside a `Popover`/`PopoverContent` (the toolbar field popover or the Appearance
 * section), so it owns no dialog role of its own. The active tab lives in the UI store
 * (`stylePickerTab`) so the toolbar and the inspector share it.
 */
import { MAX_SWATCHES } from '@sododeck/model';
import type { ColorRef } from '@sododeck/schema';
import { ColourArea } from '@sododeck/ui/components/colour-area';
import { HueSlider } from '@sododeck/ui/components/hue-slider';
import { Input } from '@sododeck/ui/components/input';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import { Swatch, SwatchGrid } from '@sododeck/ui/components/swatch-grid';
import { hexToHsv, hsvToHex, normalizeHex } from '@sododeck/ui/lib/colour';
import { readableText } from '@sododeck/ui/lib/contrast';
import { Ban, Plus } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

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
  /** Selected items that can't be coloured (020 T037): drives the "Colours X of Y" footer. */
  skipped?: { colored: number; total: number };
  /** Live, unsaved preview while the add panel holds a valid value (020 T048, R9). */
  onPreview?: (channel: 'fill' | 'stroke', value: string | null) => void;
  /** Saves a new hex colour to the deck and applies it (020 T044/T046). */
  onAddColour?: (channel: 'fill' | 'stroke', hex: string) => void;
  /** Removes a custom hex colour from the deck (020 T050/T051). */
  onRemoveColour?: (hex: string) => void;
}

const DEFAULT_HSV = { h: 262, s: 0.6, v: 0.4 };

/**
 * The "Add a deck colour" panel (020 T043/T047, contract "Add a deck colour"): the hex field and
 * the HSV controls stay in sync both ways. Live-previews a valid value on the active channel;
 * Cancel and Esc clear the preview and return to the palette without writing anything.
 */
function AddColourPanel({
  onAdd,
  onPreview,
  onCancel,
}: {
  onAdd: (hex: string) => void;
  onPreview: (value: string | null) => void;
  onCancel: () => void;
}) {
  const [hexText, setHexText] = useState('');
  const [hsv, setHsv] = useState(DEFAULT_HSV);
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the hex field on open so Escape (handled below) lands inside the panel rather than on
  // a detached "Add a deck colour" button (which unmounts when this panel replaces it).
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const normalized = normalizeHex(hexText);
  const valid = normalized !== null;
  const warn = valid && !readableText(normalized).readable;

  const setFromHex = (text: string) => {
    setHexText(text);
    const next = normalizeHex(text);
    if (next !== null) {
      setHsv(hexToHsv(next));
      onPreview(next);
    } else {
      onPreview(null);
    }
  };

  const setFromHsv = (next: typeof hsv) => {
    setHsv(next);
    const hex = hsvToHex(next);
    setHexText(hex);
    onPreview(hex);
  };

  return (
    <div
      className="flex flex-col gap-3"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <ColourArea
        hue={hsv.h}
        saturation={hsv.s}
        value={hsv.v}
        onChange={({ s, v }) => {
          setFromHsv({ ...hsv, s, v });
        }}
      />
      <HueSlider
        hue={hsv.h}
        onChange={(h) => {
          setFromHsv({ ...hsv, h });
        }}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor={`${errorId}-input`} className="text-caption text-ink-secondary">
          Hex colour
        </label>
        <Input
          ref={inputRef}
          id={`${errorId}-input`}
          aria-label="Hex colour"
          value={hexText}
          invalid={hexText !== '' && !valid}
          aria-describedby={hexText !== '' && !valid ? errorId : undefined}
          onChange={(event) => {
            setFromHex(event.target.value);
          }}
          placeholder="#7a3cff"
        />
        {hexText !== '' && !valid ? (
          <p id={errorId} className="text-body-sm text-clay-ink">
            Enter a 6-digit hex colour, e.g. #7a3cff
          </p>
        ) : null}
        {warn ? (
          <p role="status" className="text-body-sm text-clay-ink">
            Text may be hard to read on this colour
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!valid}
          onClick={() => {
            if (normalized !== null) onAdd(normalized);
          }}
          className="h-8 flex-1 rounded-button bg-primary px-3 text-body-sm text-on-primary disabled:opacity-50"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-8 flex-1 rounded-button border border-border px-3 text-body-sm text-ink hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function StylePicker({
  value,
  onApply,
  skipped,
  deckColours = [],
  onPreview,
  onAddColour,
  onRemoveColour,
}: StylePickerProps) {
  const tab = useUiStore((s) => s.stylePickerTab);
  const setTab = useUiStore((s) => s.setStylePickerTab);
  const [hovered, setHovered] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const channel = value[tab];
  const checked = !channel.mixed && channel.value !== null ? channel.value : null;
  const checkedNamed = checked !== null && isNamedColor(checked) ? checked : null;
  const checkedHex = checked !== null && !isNamedColor(checked) ? checked : null;

  const options = CARD_COLORS.map((colour) => ({
    value: colour,
    label: colourName(colour),
    swatch: `var(--color-card-${colour}-${tab})`,
  }));
  const deckOptions = deckColours.map(({ hex }) => ({ value: hex, label: hex, swatch: hex }));
  const checkedHexInDeck =
    checkedHex !== null && deckColours.some((c) => c.hex === checkedHex) ? checkedHex : null;

  const activeName = hovered !== null && isNamedColor(hovered) ? hovered : checkedNamed;
  const activeHex =
    hovered !== null && !isNamedColor(hovered) ? hovered : (checkedHex ?? undefined);
  const atCap = deckColours.length >= MAX_SWATCHES;

  const footer =
    activeName !== null
      ? `${colourName(activeName)} · card-${activeName}-${tab}`
      : activeHex !== undefined
        ? activeHex
        : channel.mixed
          ? 'Mixed'
          : atCap
            ? `${String(MAX_SWATCHES)} of ${String(MAX_SWATCHES)} deck colours: remove one to add another`
            : skipped !== undefined
              ? `Colours ${String(skipped.colored)} of ${String(skipped.total)} selected items`
              : 'No colour';

  const closeAdd = () => {
    setAddOpen(false);
    onPreview?.(tab, null);
  };

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
      {addOpen ? (
        <AddColourPanel
          onPreview={(next) => {
            onPreview?.(tab, next);
          }}
          onAdd={(hex) => {
            onAddColour?.(tab, hex);
            closeAdd();
          }}
          onCancel={closeAdd}
        />
      ) : (
        <>
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
          {deckOptions.length > 0 ? (
            <SwatchGrid
              label="Deck colours"
              options={deckOptions}
              value={checkedHexInDeck}
              columns={7}
              onSelect={(next) => {
                onApply(tab, next);
              }}
              onHoverChange={setHovered}
              removable
              onRemove={onRemoveColour}
            />
          ) : null}
          {atCap ? null : (
            <button
              type="button"
              onClick={() => {
                setAddOpen(true);
              }}
              className="flex h-8 items-center gap-2 rounded-button border border-dashed border-border px-2 text-body-sm text-ink hover:bg-surface-2"
            >
              <Plus aria-hidden size={16} strokeWidth={1.5} />
              Add a deck colour
            </button>
          )}
        </>
      )}
      <p role="status" className="text-body-sm text-ink-secondary">
        {footer}
      </p>
    </div>
  );
}

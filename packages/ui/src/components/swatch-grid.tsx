import { Check } from 'lucide-react';
import { useRef, useState } from 'react';
import type * as React from 'react';

import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';

/** The `--swatch` / `--swatch-ring` custom properties for one colour value. */
function swatchStyle(swatch: string, ringSwatch?: string): React.CSSProperties {
  return {
    '--swatch': swatch,
    '--swatch-ring': ringSwatch ?? swatch,
  } as React.CSSProperties;
}

/** 28px colour circle, decorative on its own: checked state is on the wrapping radio. */
function Swatch({
  swatch,
  ringSwatch,
  checked = false,
  className,
}: {
  /** CSS value for the `--swatch` custom property (hex or a `var(--color-...)` token). */
  swatch: string;
  /** CSS value for the `--swatch-ring` custom property; defaults to `swatch`. */
  ringSwatch?: string;
  checked?: boolean;
  className?: string;
}) {
  return (
    <span
      data-slot="swatch"
      data-checked={checked || undefined}
      aria-hidden
      className={cn(
        'pointer-events-none relative flex size-7 shrink-0 items-center justify-center rounded-full bg-(--swatch) ring-1 ring-(--swatch-ring)',
        'data-[checked]:ring-2 data-[checked]:ring-primary data-[checked]:ring-offset-2 data-[checked]:ring-offset-surface',
        className,
      )}
      style={swatchStyle(swatch, ringSwatch)}
    >
      {checked ? (
        <Check aria-hidden size={14} strokeWidth={ICON_STROKE_WIDTH} className="text-surface" />
      ) : null}
    </span>
  );
}

export interface SwatchOption {
  value: string;
  label: string;
  /** CSS value for the `--swatch` custom property. */
  swatch: string;
  ringSwatch?: string;
}

interface SwatchGridProps {
  /** Accessible name of the radiogroup, e.g. "Colours" or "Deck colours". */
  label: string;
  options: readonly SwatchOption[];
  /** The checked option's value, or `null` when nothing is checked (e.g. mixed selection). */
  value: string | null;
  /** Grid column count for ↑/↓ navigation (contract: 7 for the named palette). */
  columns?: number;
  onSelect: (value: string) => void;
  className?: string;
}

/**
 * A grid of colour radios (contract "Picker (StylePopover, dialog)"): a roving tabindex moves
 * with ←/→ (by 1) and ↑/↓ (by `columns`), Home/End jump to the ends, and Enter/Space apply the
 * focused swatch. Arrow keys only move focus; they never apply on their own.
 */
function SwatchGrid({ label, options, value, columns = 7, onSelect, className }: SwatchGridProps) {
  const checkedIndex = options.findIndex((option) => option.value === value);
  const [activeIndex, setActiveIndex] = useState(checkedIndex === -1 ? 0 : checkedIndex);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusIndex = (index: number) => {
    if (index < 0 || index >= options.length) return;
    setActiveIndex(index);
    refs.current[index]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        focusIndex(index + 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        focusIndex(index - 1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        focusIndex(index + columns);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusIndex(index - columns);
        break;
      case 'Home':
        event.preventDefault();
        focusIndex(0);
        break;
      case 'End':
        event.preventDefault();
        focusIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const option = options[index];
        if (option !== undefined) onSelect(option.value);
        break;
      }
      default:
        break;
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('grid gap-2', className)}
      style={{ gridTemplateColumns: `repeat(${String(columns)}, minmax(0, 1fr))` }}
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.label}
            tabIndex={index === activeIndex ? 0 : -1}
            onClick={() => {
              onSelect(option.value);
            }}
            onKeyDown={(event) => {
              onKeyDown(event, index);
            }}
            onFocus={() => {
              setActiveIndex(index);
            }}
            style={swatchStyle(option.swatch, option.ringSwatch)}
            className={cn('rounded-full', focusRing)}
          >
            <Swatch swatch={option.swatch} ringSwatch={option.ringSwatch} checked={checked} />
          </button>
        );
      })}
    </div>
  );
}

export { Swatch, SwatchGrid };

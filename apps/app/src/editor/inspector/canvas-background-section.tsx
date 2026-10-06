import { canvasBackgroundOf, type ResolvedCanvasBackground } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { Input } from '@sododeck/ui/components/input';
import { PanelSection } from '@sododeck/ui/components/panel';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import { normalizeHex } from '@sododeck/ui/lib/colour';
import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import { RotateCcw } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { useEditor } from '../../model/use-editor';
import { useThemeStore } from '../../theme/theme-store';
import { LIGHT_PALETTE } from '../export/export-palette';
import { oneStep } from '../fields/one-step';

const PATTERNS: readonly { value: ResolvedCanvasBackground['pattern']; label: string }[] = [
  { value: 'dots', label: 'Dots' },
  { value: 'grid', label: 'Grid' },
  { value: 'none', label: 'None' },
];

/**
 * The theme's canvas colour as a hex, for the colour well while the deck follows the theme (a
 * native colour input needs a value). Read from the token so light and dark both show right.
 */
function themeCanvas(): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--sd-canvas');
  return normalizeHex(value) ?? LIGHT_PALETTE.canvas;
}

/**
 * Deck settings › Canvas (ADR 0044): the canvas background pattern (dots, grid, none) and a free
 * colour (native colour well + hex field), saved in the deck file. With no colour the canvas
 * follows the theme, so dark mode keeps working; "Reset to theme default" removes both keys.
 * Each change is one undo step: the colour well commits on its native `change` (when the picker
 * closes), not on every `input` while dragging, and the hex field on Enter or blur.
 */
export function CanvasBackgroundSection({ deck }: { deck: SododeckFile }) {
  const editor = useEditor();
  const id = useId();
  // Re-read the theme colour when the theme changes.
  const theme = useThemeStore((state) => state.theme);
  const background = canvasBackgroundOf(deck);
  const stored = background.color;
  const [wellDraft, setWellDraft] = useState<string | null>(null);
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const well = useRef<HTMLInputElement>(null);
  const write = (patch: Parameters<typeof editor.setCanvasBackground>[0]) => {
    oneStep(editor, () => {
      editor.setCanvasBackground(patch);
    });
  };

  // React's `onChange` on a colour input is the native `input` event (every drag step); the
  // native `change` fires once the picker closes, which is the one write.
  useEffect(() => {
    const element = well.current;
    if (element === null) return;
    const onChange = () => {
      const hex = normalizeHex(element.value);
      setWellDraft(null);
      if (hex === null) return;
      oneStep(editor, () => {
        editor.setCanvasBackground({ color: hex });
      });
    };
    element.addEventListener('change', onChange);
    return () => {
      element.removeEventListener('change', onChange);
    };
  }, [editor]);

  const hexText = hexDraft ?? stored ?? '';
  const hexValid = hexText === '' || normalizeHex(hexText) !== null;
  const commitHex = () => {
    if (hexDraft === null) return;
    const hex = normalizeHex(hexDraft);
    if (hexDraft.trim() === '') {
      setHexDraft(null);
      write({ color: null });
    } else if (hex !== null) {
      setHexDraft(null);
      write({ color: hex });
    }
  };
  const isDefault = background.pattern === 'dots' && stored === undefined;

  return (
    <PanelSection label="Canvas">
      <div className="flex h-8 items-center justify-between gap-3">
        <span id={`${id}-pattern`} className="text-body-sm text-ink">
          Background
        </span>
        <SegmentedControl
          aria-labelledby={`${id}-pattern`}
          value={background.pattern}
          onValueChange={(value) => {
            if (value === 'grid' || value === 'none') write({ pattern: value });
            else if (value === 'dots') write({ pattern: null });
          }}
        >
          {PATTERNS.map(({ value, label }) => (
            <SegmentedControlItem key={value} value={value}>
              {label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-hex`} className="text-body-sm text-ink">
          Background colour
        </label>
        <div className="flex items-center gap-2">
          <input
            ref={well}
            type="color"
            aria-label="Pick background colour"
            // `theme` keeps the well in step with the theme while the deck follows it.
            data-theme={theme}
            value={wellDraft ?? stored ?? themeCanvas()}
            onChange={(event) => {
              setWellDraft(event.target.value);
            }}
            className={cn(
              'size-8 shrink-0 cursor-pointer rounded-button border border-border bg-surface p-0.5',
              focusRing,
            )}
          />
          <Input
            id={`${id}-hex`}
            value={hexText}
            placeholder="Theme"
            spellCheck={false}
            invalid={!hexValid}
            aria-describedby={hexValid ? `${id}-hint` : `${id}-error`}
            onChange={(event) => {
              setHexDraft(event.target.value);
            }}
            onBlur={commitHex}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitHex();
              if (event.key === 'Escape' && hexDraft !== null) {
                event.stopPropagation();
                setHexDraft(null);
              }
            }}
          />
        </div>
        {hexValid ? (
          <p id={`${id}-hint`} className="text-caption text-ink-secondary">
            {stored === undefined
              ? 'Follows the light or dark theme.'
              : 'Saved in this deck, the same in light and dark.'}
          </p>
        ) : (
          <p id={`${id}-error`} className="text-caption text-clay-ink">
            Enter a 6-digit hex colour, e.g. #f4efe6
          </p>
        )}
      </div>
      <div>
        <Button
          variant="ghost"
          size="sm"
          disabled={isDefault}
          onClick={() => {
            setHexDraft(null);
            setWellDraft(null);
            write({ pattern: null, color: null });
          }}
        >
          <RotateCcw />
          Reset to theme default
        </Button>
      </div>
    </PanelSection>
  );
}

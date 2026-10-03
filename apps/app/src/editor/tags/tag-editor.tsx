/**
 * The tag editor (033, contracts/tag-ui.md), shown inside the tag picker's popover: the colour of
 * one tag for the whole deck. Choosing a colour applies it at once as one undo step. Esc and the
 * Back button return to the list.
 */
import { SwatchGrid, type SwatchOption } from '@sododeck/ui/components/swatch-grid';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { ArrowLeft } from 'lucide-react';

import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { CARD_COLORS, colourName } from '../style/card-style';
import { tagColourOf } from './deck-tags';

const NO_COLOUR = '';

export function TagEditor({ tag, onBack }: { tag: string; onBack: () => void }) {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const current = tagColourOf(deck, tag);

  const options: SwatchOption[] = [
    ...CARD_COLORS.map((colour) => ({
      value: colour,
      label: colourName(colour),
      swatch: `var(--color-card-${colour}-chip)`,
      ringSwatch: `var(--color-card-${colour}-dot)`,
    })),
    {
      value: NO_COLOUR,
      label: 'No colour',
      swatch: 'var(--color-surface)',
      ringSwatch: 'var(--color-ink-muted)',
    },
    ...(deck.swatches ?? []).map((hex) => ({ value: hex, label: hex, swatch: hex })),
  ];

  const choose = (value: string) => {
    const colour = value === NO_COLOUR ? null : value;
    editor.setTagColor(tag, colour);
    useUiStore
      .getState()
      .announce(
        colour === null ? `${tag} colour cleared` : `${tag} colour set to ${colourName(colour)}`,
      );
  };

  return (
    <div
      className="flex flex-col gap-3"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        onBack();
      }}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Back to tags"
          // The pencil that opened the editor is gone, so focus starts here and Esc is heard.
          autoFocus
          onClick={onBack}
          className={cn(
            'inline-flex size-6 cursor-pointer items-center justify-center rounded-full text-ink-secondary hover:bg-surface-2 hover:text-ink',
            focusRing,
          )}
        >
          <ArrowLeft aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-caption font-medium tracking-wide text-ink-secondary uppercase">
          Edit tag · {tag}
        </h2>
      </div>
      <SwatchGrid
        label="Tag colour"
        options={options}
        value={current ?? NO_COLOUR}
        onSelect={choose}
      />
    </div>
  );
}

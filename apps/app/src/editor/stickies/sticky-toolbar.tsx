import { SwatchGrid, type SwatchOption } from '@sododeck/ui/components/swatch-grid';

import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { oneStep } from '../fields/one-step';
import { STICKY_COLORS, stickyColourName, stickySwatch } from './sticky-tint';

const OPTIONS: readonly SwatchOption[] = STICKY_COLORS.map((colour) => ({
  value: colour,
  label: stickyColourName(colour),
  ...stickySwatch(colour),
}));

/**
 * The note toolbar's colour popover (053 US3): the five paper colours, the shared one ticked.
 * A pick recolours every selected note as one undo step and becomes the colour new notes get
 * (`lastStickyColour`, UI-only).
 */
export function StickyColourPopover({ stickyIds }: { stickyIds: readonly string[] }) {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const colours = new Set(
    deck.stickies.filter((sticky) => stickyIds.includes(sticky.id)).map((s) => s.color ?? 'amber'),
  );
  const [only] = colours;
  return (
    <SwatchGrid
      label="Note colours"
      options={OPTIONS}
      columns={5}
      value={colours.size === 1 && only !== undefined ? only : null}
      onSelect={(value) => {
        const colour = STICKY_COLORS.find((candidate) => candidate === value);
        if (colour === undefined) return;
        oneStep(editor, () => {
          editor.setStickyColour([...stickyIds], colour);
        });
        const ui = useUiStore.getState();
        ui.setLastStickyColour(colour);
        ui.announce(`Note colour set to ${stickyColourName(colour)}`);
        ui.closeToolbarField();
      }}
    />
  );
}

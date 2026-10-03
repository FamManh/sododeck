import type { SododeckFile } from '@sododeck/schema';
import type { SwatchOption } from '@sododeck/ui/components/swatch-grid';

import { CARD_COLORS, colourName } from '../style/card-style';

/** Value of "No colour" (slate) in an option colour grid. */
export const NO_OPTION_COLOUR = '';

/** Colours an option can take (032 edge cases): the 13 card colours, none, then deck colours. */
export function optionColourChoices(deck: Pick<SododeckFile, 'swatches'>): SwatchOption[] {
  return [
    ...CARD_COLORS.map((colour) => ({
      value: colour,
      label: colourName(colour),
      swatch: `var(--color-card-${colour}-chip)`,
      ringSwatch: `var(--color-card-${colour}-dot)`,
    })),
    {
      value: NO_OPTION_COLOUR,
      label: 'No colour',
      swatch: 'var(--color-surface)',
      ringSwatch: 'var(--color-ink-muted)',
    },
    ...(deck.swatches ?? []).map((hex) => ({ value: hex, label: hex, swatch: hex })),
  ];
}

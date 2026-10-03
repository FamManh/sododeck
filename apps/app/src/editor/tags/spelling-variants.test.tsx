import { toJSON } from '@sododeck/model';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { canonicalTag, deckTags } from './deck-tags';
import { TagPicker } from './tag-picker';

/** SC-004: no spelling of one tag ever makes a second tag. */
const VARIANTS = [
  'pci dss',
  'PCI DSS',
  'Pci Dss',
  'pCi dSs',
  ' pci dss',
  'pci dss ',
  '  pci   dss  ',
  'PCI  DSS',
  'pci\tdss',
  'Pci Dss'.replace(' ', ' '),
  'PCI dss',
  'pci DSS',
  'PcI DsS',
  ' PCI DSS ',
  'pci  dss',
  'PCI   DSS',
  'pcI dss',
  'pci dsS',
  '\tPCI DSS',
  'PCI DSS\t',
];

const deck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A', tags: ['PCI DSS'] },
    { id: 'b', type: 'service', title: 'B' },
  ],
});

describe('spelling variants of one tag (033 SC-004)', () => {
  it('has 20 variants', () => {
    expect(VARIANTS).toHaveLength(20);
  });

  it.each(VARIANTS)('canonicalTag resolves %j to the existing spelling', (variant) => {
    expect(canonicalTag(deck, variant)).toBe('PCI DSS');
  });

  it.each(VARIANTS)('the picker never lists or writes a second tag for %j', async (variant) => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<TagPicker nodeIds={['b']} />, deck);
    // A tab is typed as a space by the field, as in a browser input.
    await user.type(
      screen.getByRole('searchbox', { name: 'Filter tags' }),
      `${variant.replace(/\t/g, ' ')}{Enter}`,
    );
    const file = toJSON(doc);
    expect(file.nodes.find((n) => n.id === 'b')?.tags).toEqual(['PCI DSS']);
    expect(deckTags(file)).toHaveLength(1);
  });
});

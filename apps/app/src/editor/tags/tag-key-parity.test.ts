import { tagKey as modelTagKey } from '@sododeck/model';
import { tagKey as uiTagKey } from '@sododeck/ui/lib/tags';
import { describe, expect, it } from 'vitest';

/** The model and the ui package each carry the one-line key rule; this keeps them equal (033 R4). */
const SAMPLES = [
  '',
  ' ',
  '   ',
  'a',
  'A',
  'PCI',
  'pci',
  ' PCI ',
  'Pci   DSS',
  'pci\tdss',
  'pci\ndss',
  'pci dss',
  'Crème brûlée',
  'CRÈME',
  'café',
  'cafe',
  'İstanbul',
  'ΣΊΣΥΦΟΣ',
  'straße',
  'ǅ',
  '日本語',
  '日本 語',
  '🔥 hot',
  'a-b_c.d',
  'SLA-1',
  'x'.repeat(200),
  ' X '.repeat(40),
  'Zone  A',
  'zone a',
  '\t\tmixed Case\t',
];

describe('tagKey parity (model and ui)', () => {
  it('has 30 samples', () => {
    expect(SAMPLES).toHaveLength(30);
  });

  it.each(SAMPLES)('agrees on %j', (sample) => {
    expect(uiTagKey(sample)).toBe(modelTagKey(sample));
  });
});

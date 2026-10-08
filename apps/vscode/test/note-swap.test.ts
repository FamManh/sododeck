import { describe, expect, it } from 'vitest';

import { shouldSwapToCanvas } from '../src/note-swap';

const base = { fileName: 'a.sododeck.md', hasMarker: true, chosenText: false };

describe('shouldSwapToCanvas', () => {
  it('swaps a marked .sododeck.md', () => {
    expect(shouldSwapToCanvas(base)).toBe(true);
    expect(shouldSwapToCanvas({ ...base, fileName: 'A.SODODECK.MD' })).toBe(true);
  });

  it('keeps text when the user chose it', () => {
    expect(shouldSwapToCanvas({ ...base, chosenText: true })).toBe(false);
  });

  it('keeps text without a marker (also a partial one)', () => {
    expect(shouldSwapToCanvas({ ...base, hasMarker: false })).toBe(false);
  });

  it('ignores other names', () => {
    for (const fileName of [
      'notes.md',
      'a.sododeck.markdown',
      'a.markdown',
      'a.sododeck.json',
      'a.sododeck',
    ]) {
      expect(shouldSwapToCanvas({ ...base, fileName })).toBe(false);
    }
  });
});

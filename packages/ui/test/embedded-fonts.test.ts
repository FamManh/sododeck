import { describe, expect, it } from 'vitest';

import { EMBEDDED_FONT_CSS } from '@sododeck/ui/lib/embedded-fonts';

describe('EMBEDDED_FONT_CSS', () => {
  it('has four @font-face rules with inline woff2 data and no external URL', () => {
    expect(EMBEDDED_FONT_CSS.match(/@font-face/g)).toHaveLength(4);
    expect(EMBEDDED_FONT_CSS.match(/src:url\(data:font\/woff2;base64,/g)).toHaveLength(4);
    expect(EMBEDDED_FONT_CSS).not.toMatch(/https?:/);
    // The real font files, not an empty stub (about 120 KB of fonts, base64).
    expect(EMBEDDED_FONT_CSS.length).toBeGreaterThan(100_000);
  });

  it('covers both families with latin and latin-ext ranges', () => {
    expect(EMBEDDED_FONT_CSS.match(/font-family:'Geist Variable'/g)).toHaveLength(2);
    expect(EMBEDDED_FONT_CSS.match(/font-family:'Geist Mono Variable'/g)).toHaveLength(2);
    expect(EMBEDDED_FONT_CSS.match(/unicode-range:U\+0000-00FF/g)).toHaveLength(2);
  });
});

import { describe, expect, it } from 'vitest';

import { cleanLabel } from './clean-text';

describe('cleanLabel', () => {
  it.each([
    ['Web app', 'Web app'],
    ['  padded  ', 'padded'],
    ['"quoted label"', 'quoted label'],
    ['line one<br/>line two', 'line one\nline two'],
    ['a<br>b<BR />c', 'a\nb\nc'],
    ['<b>bold</b> and <i>it</i>', 'bold and it'],
    ['R&amp;D &lt;team&gt; &quot;x&quot; &#65;&#x42;', 'R&D <team> "x" AB'],
    ['Pay 💳 now', 'Pay 💳 now'],
    ['&unknown; stays', '&unknown; stays'],
  ])('%j → %j', (raw, expected) => {
    expect(cleanLabel(raw)).toBe(expected);
  });

  it('removes script and image tags, leaving only text', () => {
    expect(cleanLabel('<script>alert(1)</script>Hi')).toBe('alert(1)Hi');
    expect(cleanLabel('<img src=x onerror=alert(1)>Hi')).toBe('Hi');
  });

  it('keeps a long title whole', () => {
    const long = 'x'.repeat(500);
    expect(cleanLabel(long)).toBe(long);
  });
});

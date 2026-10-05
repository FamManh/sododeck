import { describe, expect, it } from 'vitest';

import { sanitizeSvg } from './sanitize-svg';

const NS = 'xmlns="http://www.w3.org/2000/svg"';
const wrap = (inner: string, attrs = '') =>
  `<svg ${NS} width="40" height="20" ${attrs}>${inner}</svg>`;

function refused(source: string) {
  const result = sanitizeSvg(source);
  expect(result.ok).toBe(false);
  return result.ok ? null : result.reason;
}

describe('sanitizeSvg: accepted', () => {
  it('re-serialises shapes, text, gradients and safe styles', () => {
    const result = sanitizeSvg(
      wrap(
        '<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs>' +
          '<rect width="10" height="10" fill="url(#g)" style="stroke:red;fill:url(#g)"/>' +
          '<text x="1" y="9">Hi</text><style>rect{opacity:.5}</style>',
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svg).toContain('<rect');
    expect(result.svg).toContain('url(#g)');
    expect(result.width).toBe(40);
    expect(result.height).toBe(20);
  });

  it('allows fragment-only href and a use of a local id', () => {
    expect(
      sanitizeSvg(
        wrap(
          '<g id="a"/><use href="#a"/><use xlink:href="#a" xmlns:xlink="http://www.w3.org/1999/xlink"/>',
        ),
      ).ok,
    ).toBe(true);
  });

  it('allows an embedded raster data URI in image', () => {
    expect(
      sanitizeSvg(wrap('<image href="data:image/png;base64,AAAA" width="1" height="1"/>')).ok,
    ).toBe(true);
  });

  it('takes the size from the viewBox, then falls back to 300 x 150', () => {
    const viewBox = sanitizeSvg(`<svg ${NS} viewBox="0 0 120 60"/>`);
    expect(viewBox.ok && [viewBox.width, viewBox.height]).toEqual([120, 60]);
    const none = sanitizeSvg(`<svg ${NS}/>`);
    expect(none.ok && [none.width, none.height]).toEqual([300, 150]);
  });

  it('strips foreign-namespace elements and attributes instead of refusing', () => {
    const result = sanitizeSvg(
      `<svg ${NS} xmlns:ink="http://www.inkscape.org/namespaces/inkscape" ink:version="1"><ink:namedview id="n"/><rect width="1" height="1" ink:label="x"/></svg>`,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.svg).not.toContain('ink');
  });
});

describe('sanitizeSvg: refused', () => {
  it('refuses script and foreignObject', () => {
    expect(refused(wrap('<script>alert(1)</script>'))).toBe('script');
    expect(refused(wrap('<foreignObject><div/></foreignObject>'))).toBe('foreign-object');
  });

  it('refuses event handler attributes', () => {
    expect(refused(wrap('<rect onclick="x()" width="1" height="1"/>'))).toBe('event-handler');
    expect(refused(wrap('<rect/>', 'onload="x()"'))).toBe('event-handler');
  });

  it('refuses javascript: and external links', () => {
    expect(refused(wrap('<a href="javascript:alert(1)"><rect/></a>'))).not.toBeNull();
    expect(refused(wrap('<use href="https://example.com/a.svg#x"/>'))).toBe('external-reference');
    expect(refused(wrap('<use href="other.svg#x"/>'))).toBe('external-reference');
    expect(refused(wrap('<image href="https://example.com/a.png"/>'))).toBe('external-reference');
    expect(refused(wrap('<image href="data:text/html;base64,PGI+"/>'))).toBe('external-reference');
    expect(
      refused(
        wrap('<image xlink:href="//evil.test/a.png" xmlns:xlink="http://www.w3.org/1999/xlink"/>'),
      ),
    ).toBe('external-reference');
  });

  it('refuses outside references in styles', () => {
    expect(refused(wrap('<style>@import url(https://x.test/a.css);</style>'))).toBe(
      'external-reference',
    );
    expect(refused(wrap('<rect style="fill:url(https://x.test/a.svg#g)"/>'))).toBe(
      'external-reference',
    );
    expect(refused(wrap('<rect fill="url(http://x.test/a)"/>'))).toBe('external-reference');
    expect(refused(wrap('<style>rect{background:url("//x.test/a.png")}</style>'))).toBe(
      'external-reference',
    );
  });

  it('refuses entity declarations', () => {
    expect(
      refused(
        `<!DOCTYPE svg [<!ENTITY x "boom">]><svg ${NS} width="1" height="1"><text>&x;</text></svg>`,
      ),
    ).toBe('entity');
  });

  it('refuses elements outside the allow-list (animation can rewrite hrefs)', () => {
    expect(refused(wrap('<animate attributeName="href" to="javascript:x"/>'))).toBe(
      'unsupported-element',
    );
    expect(refused(wrap('<set attributeName="href" to="javascript:x"/>'))).toBe(
      'unsupported-element',
    );
  });

  it('refuses text that is not an SVG document', () => {
    expect(refused('<svg')).toBe('unreadable');
    expect(refused('<html xmlns="http://www.w3.org/1999/xhtml"/>')).toBe('unreadable');
  });
});

describe('sanitizeSvg: output', () => {
  it('has no external reference left', () => {
    const result = sanitizeSvg(wrap('<rect width="1" height="1"/>'));
    expect(result.ok && /https?:\/\/(?!www\.w3\.org)/.test(result.svg)).toBe(false);
  });
});

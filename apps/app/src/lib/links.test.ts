import { describe, expect, it } from 'vitest';

import { LINK_REFUSED, parseLinkInput } from './links';

describe('parseLinkInput (research R6)', () => {
  it('accepts http and https URLs, labelled with the host minus www.', () => {
    expect(parseLinkInput('https://runbooks.example.com/pricing')).toEqual({
      ok: true,
      link: { url: 'https://runbooks.example.com/pricing', label: 'runbooks.example.com' },
    });
    expect(parseLinkInput('http://www.example.com')).toEqual({
      ok: true,
      link: { url: 'http://www.example.com', label: 'example.com' },
    });
  });

  it('accepts relative paths, labelled with their last segment', () => {
    expect(parseLinkInput('docs/runbooks/pricing.md')).toEqual({
      ok: true,
      link: { url: 'docs/runbooks/pricing.md', label: 'pricing.md' },
    });
    expect(parseLinkInput('/specs/quote/')).toEqual({
      ok: true,
      link: { url: '/specs/quote/', label: 'quote' },
    });
    expect(parseLinkInput('./notes#top')).toMatchObject({ ok: true, link: { label: 'notes' } });
  });

  it('refuses other schemes and protocol-relative links', () => {
    for (const text of [
      'javascript:alert(1)',
      ' JavaScript:alert(1)',
      'data:text/html,hi',
      'file:///etc/passwd',
      '//evil.example.com',
      'mailto:a@b.c',
      'https://',
    ]) {
      expect(parseLinkInput(text)).toEqual({ ok: false, error: LINK_REFUSED });
    }
    expect(LINK_REFUSED).toBe('Only http, https or relative links');
  });

  it('trims the text and refuses an empty one', () => {
    expect(parseLinkInput('  https://a.example/x  ')).toMatchObject({
      ok: true,
      link: { url: 'https://a.example/x' },
    });
    expect(parseLinkInput('   ')).toEqual({ ok: false, error: null });
  });
});

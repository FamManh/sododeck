import { describe, expect, it } from 'vitest';

import { sniffType } from './sniff-type';
import { TEST_PICTURES } from './test-pictures';

const text = (value: string) => new TextEncoder().encode(value);

describe('sniffType', () => {
  it.each(Object.entries(TEST_PICTURES))('detects %s from its bytes', (type, bytes) => {
    expect(sniffType(bytes)).toBe(type);
  });

  it('does not depend on a name or declared type (a PNG stays a PNG)', () => {
    // Only the bytes are passed, so a ".jpg" name cannot matter.
    expect(sniffType(TEST_PICTURES['image/png'])).toBe('image/png');
  });

  it('detects an SVG after an XML prolog, doctype and comments', () => {
    expect(
      sniffType(
        text(
          '﻿<?xml version="1.0"?>\n<!-- made by hand -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x.dtd">\n<svg xmlns="http://www.w3.org/2000/svg"/>',
        ),
      ),
    ).toBe('image/svg+xml');
  });

  it('refuses HEIC, BMP, PDF and text', () => {
    const heic = new Uint8Array([
      0,
      0,
      0,
      24,
      ...text('ftypheic'),
      0,
      0,
      0,
      0,
      ...text('mif1heic'),
    ]);
    expect(sniffType(heic)).toBeNull();
    expect(sniffType(text('BM\u0000\u0000\u0000\u0000'))).toBeNull();
    expect(sniffType(text('%PDF-1.7'))).toBeNull();
    expect(sniffType(text('hello <svg is not first'))).toBeNull();
    expect(sniffType(new Uint8Array())).toBeNull();
  });

  it('refuses a RIFF file that is not WebP', () => {
    expect(sniffType(text('RIFF....WAVEfmt '))).toBeNull();
  });
});

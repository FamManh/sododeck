import { describe, expect, it } from 'vitest';

import { assetId, MAX_ASSET_BYTES, pictureFileEntry, pictureSize, sniffType } from '../src';
import * as pics from './picture-fixtures';

const TEST_PICTURES = {
  'image/png': pics.PNG_1X1,
  'image/jpeg': pics.JPEG_1X1,
  'image/webp': pics.WEBP_1X1,
  'image/gif': pics.GIF_1X1,
  'image/avif': pics.AVIF_2X2,
  'image/svg+xml': pics.SVG_WITH_SIZE,
} as const;

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

describe('pictureSize (068)', () => {
  it.each([
    ['a PNG', pics.PNG_1X1, 'image/png', { width: 1, height: 1 }],
    ['a JPEG', pics.JPEG_1X1, 'image/jpeg', { width: 1, height: 1 }],
    [
      'a JPEG with EXIF before the frame',
      pics.JPEG_WITH_EXIF,
      'image/jpeg',
      { width: 640, height: 480 },
    ],
    ['a GIF', pics.GIF_1X1, 'image/gif', { width: 1, height: 1 }],
    ['a lossless WebP (VP8L)', pics.WEBP_1X1, 'image/webp', { width: 1, height: 1 }],
    ['a lossy WebP (VP8)', pics.WEBP_LOSSY, 'image/webp', { width: 320, height: 240 }],
    ['an extended WebP (VP8X)', pics.WEBP_EXTENDED, 'image/webp', { width: 1000, height: 500 }],
    ['an AVIF', pics.AVIF_2X2, 'image/avif', { width: 2, height: 2 }],
    [
      'an SVG with width and height',
      pics.SVG_WITH_SIZE,
      'image/svg+xml',
      { width: 40, height: 20 },
    ],
    [
      'an SVG with a viewBox only',
      pics.SVG_WITH_VIEWBOX,
      'image/svg+xml',
      { width: 64, height: 48 },
    ],
    ['an SVG with neither', pics.SVG_WITH_NEITHER, 'image/svg+xml', { width: 300, height: 150 }],
    ['an SVG sized in percent', pics.SVG_WITH_PERCENT, 'image/svg+xml', { width: 10, height: 20 }],
  ] as const)('reads %s', (_name, bytes, type, size) => {
    expect(pictureSize(bytes, type)).toEqual(size);
  });

  it.each([
    ['a PNG', pics.PNG_1X1, 'image/png'],
    ['a JPEG', pics.JPEG_WITH_EXIF, 'image/jpeg'],
    ['a GIF', pics.GIF_1X1, 'image/gif'],
    ['a WebP', pics.WEBP_LOSSY, 'image/webp'],
    ['an AVIF', pics.AVIF_2X2, 'image/avif'],
  ] as const)('returns null for a truncated %s', (_name, bytes, type) => {
    expect(pictureSize(bytes.subarray(0, 9), type)).toBeNull();
  });

  it('returns null for an SVG with no svg tag', () => {
    expect(pictureSize(new TextEncoder().encode('<g/>'), 'image/svg+xml')).toBeNull();
  });
});

describe('pictureFileEntry (068)', () => {
  it('builds a complete entry whose id is the hash of the file', () => {
    const result = pictureFileEntry(pics.WEBP_LOSSY, 'shot.webp', 'assets/shot.webp');
    expect(result).toEqual({
      ok: true,
      id: assetId(pics.WEBP_LOSSY),
      entry: {
        type: 'image/webp',
        bytes: pics.WEBP_LOSSY.length,
        width: 320,
        height: 240,
        name: 'shot.webp',
        path: 'assets/shot.webp',
      },
    });
  });

  it('refuses a type outside the allow-list, a file over 5 MiB, an unreadable size and a bad path', () => {
    expect(pictureFileEntry(pics.BMP, 'a.bmp', 'a.bmp')).toEqual({ ok: false, reason: 'bad-type' });
    const big = new Uint8Array(MAX_ASSET_BYTES + 1);
    big.set(pics.PNG_1X1);
    expect(pictureFileEntry(big, 'big.png', 'big.png')).toEqual({ ok: false, reason: 'too-large' });
    expect(pictureFileEntry(pics.PNG_1X1.subarray(0, 14), 'a.png', 'a.png')).toEqual({
      ok: false,
      reason: 'no-size',
    });
    expect(pictureFileEntry(pics.PNG_1X1, 'a.png', 'a/../a.png')).toEqual({
      ok: false,
      reason: 'inner-parent',
    });
  });
});

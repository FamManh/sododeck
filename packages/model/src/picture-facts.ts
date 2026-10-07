/**
 * Facts about a picture file, read from its bytes (068 R6): the type, the natural size, and a
 * complete `assets` entry for a file that stays next to the deck. Pure, no DOM and no platform
 * crypto, so the web app and the skill's Node scripts share one implementation.
 */
import { checkPicturePath, type Asset, type AssetType, type PathViolation } from '@sododeck/schema';

import { assetId, MAX_ASSET_BYTES, type AssetId } from './assets';

/**
 * The picture type from the first bytes, ignoring the file name and the declared type (a PNG
 * named `.jpg` is a PNG). `null` for anything outside the allow-list (HEIC, BMP, PDF, text...).
 */
export function sniffType(bytes: Uint8Array): AssetType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) && (bytes[4] === 0x37 || bytes[4] === 0x39)) {
    return 'image/gif';
  }
  if (startsWith(bytes, ascii('RIFF')) && matchesAt(bytes, 8, ascii('WEBP'))) return 'image/webp';
  if (isAvif(bytes)) return 'image/avif';
  if (looksLikeSvg(bytes)) return 'image/svg+xml';
  return null;
}

function ascii(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0));
}

function matchesAt(bytes: Uint8Array, offset: number, pattern: number[]): boolean {
  return pattern.every((value, index) => bytes[offset + index] === value);
}

function startsWith(bytes: Uint8Array, pattern: number[]): boolean {
  return matchesAt(bytes, 0, pattern);
}

/** ISO base media `ftyp` box whose major or a compatible brand is `avif` / `avis`. */
function isAvif(bytes: Uint8Array): boolean {
  if (!matchesAt(bytes, 4, ascii('ftyp'))) return false;
  const boxEnd = Math.min(bytes.length, 64);
  for (let offset = 8; offset + 4 <= boxEnd; offset += 4) {
    // Offset 12 holds the minor version, not a brand.
    if (offset === 12) continue;
    if (matchesAt(bytes, offset, ascii('avif')) || matchesAt(bytes, offset, ascii('avis'))) {
      return true;
    }
  }
  return false;
}

const SVG_START =
  /^\s*(?:<\?xml[\s\S]*?\?>\s*|<!--[\s\S]*?-->\s*|<!DOCTYPE[^>[]*(?:\[[\s\S]*?\])?\s*>\s*)*<svg[\s>]/i;

function looksLikeSvg(bytes: Uint8Array): boolean {
  // TextDecoder drops a leading BOM itself.
  const head = new TextDecoder('utf-8').decode(bytes.subarray(0, 4096));
  return SVG_START.test(head);
}

interface Size {
  width: number;
  height: number;
}

const u16be = (b: Uint8Array, at: number) => ((b[at] ?? 0) << 8) | (b[at + 1] ?? 0);
const u16le = (b: Uint8Array, at: number) => (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8);
const u24le = (b: Uint8Array, at: number) => u16le(b, at) | ((b[at + 2] ?? 0) << 16);
const u32be = (b: Uint8Array, at: number) => u16be(b, at) * 0x10000 + u16be(b, at + 2);
const u32le = (b: Uint8Array, at: number) => u16le(b, at) + u16le(b, at + 2) * 0x10000;

const sized = (width: number, height: number): Size | null =>
  Number.isInteger(width) && Number.isInteger(height) && width >= 1 && height >= 1
    ? { width, height }
    : null;

function pngSize(b: Uint8Array): Size | null {
  if (b.length < 24 || !matchesAt(b, 12, ascii('IHDR'))) return null;
  return sized(u32be(b, 16), u32be(b, 20));
}

/** The first start-of-frame marker holds the size; EXIF and other segments come before it. */
function jpegSize(b: Uint8Array): Size | null {
  let at = 2;
  while (at + 4 <= b.length) {
    if (b[at] !== 0xff) return null;
    const marker = b[at + 1] ?? 0;
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    // Standalone markers have no length.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      at += 2;
      continue;
    }
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) return at + 9 <= b.length ? sized(u16be(b, at + 7), u16be(b, at + 5)) : null;
    // Entropy-coded data starts at the scan: no frame header was found.
    if (marker === 0xda) return null;
    at += 2 + u16be(b, at + 2);
  }
  return null;
}

function gifSize(b: Uint8Array): Size | null {
  return b.length < 10 ? null : sized(u16le(b, 6), u16le(b, 8));
}

function webpSize(b: Uint8Array): Size | null {
  if (b.length < 30) return null;
  if (matchesAt(b, 12, ascii('VP8X'))) return sized(u24le(b, 24) + 1, u24le(b, 27) + 1);
  if (matchesAt(b, 12, ascii('VP8L'))) {
    if (b[20] !== 0x2f) return null;
    const bits = u32le(b, 21);
    return sized((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (matchesAt(b, 12, ascii('VP8 '))) {
    if (!startsAt(b, 23, [0x9d, 0x01, 0x2a])) return null;
    return sized(u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff);
  }
  return null;
}

const startsAt = (b: Uint8Array, at: number, pattern: number[]) => matchesAt(b, at, pattern);

/** Walks ISO base media boxes (`meta` > `iprp` > `ipco`) for the first `ispe` (image spatial extents). */
function avifSize(b: Uint8Array, start = 0, end = b.length): Size | null {
  let at = start;
  while (at + 8 <= end) {
    let size = u32be(b, at);
    let header = 8;
    if (size === 1) {
      // 64-bit size: the high word must be 0 for any picture this small.
      if (u32be(b, at + 8) !== 0) return null;
      size = u32be(b, at + 12);
      header = 16;
    } else if (size === 0) size = end - at;
    if (size < header || at + size > end) return null;
    const type = String.fromCharCode(...b.subarray(at + 4, at + 8));
    const body = at + header;
    if (type === 'ispe') {
      return body + 12 <= end ? sized(u32be(b, body + 4), u32be(b, body + 8)) : null;
    }
    if (type === 'meta' || type === 'iprp' || type === 'ipco') {
      // `meta` is a full box: four bytes of version and flags come first.
      const found = avifSize(b, type === 'meta' ? body + 4 : body, at + size);
      if (found !== null) return found;
    }
    at += size;
  }
  return null;
}

const SVG_TAG = /<svg\b[^>]*>/i;
const SVG_NUMBER = /^\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*$/;

function svgAttribute(tag: string, name: string): string | undefined {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag);
  return match?.[1] ?? match?.[2];
}

/** `width` / `height` in px, else the viewBox, else 300 × 150 (the schema's stated SVG rule). */
function svgSize(b: Uint8Array): Size | null {
  const text = new TextDecoder('utf-8').decode(b.subarray(0, 65_536));
  const tag = SVG_TAG.exec(text)?.[0];
  if (tag === undefined) return null;
  const attribute = (name: string): number | undefined => {
    const value = svgAttribute(tag, name);
    const match = value === undefined ? null : SVG_NUMBER.exec(value);
    return match?.[1] === undefined ? undefined : Math.round(Number(match[1]));
  };
  const viewBox = svgAttribute(tag, 'viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  const box = viewBox?.length === 4 && viewBox.every(Number.isFinite) ? viewBox : undefined;
  const width = attribute('width') ?? (box === undefined ? 300 : Math.round(box[2] ?? 0));
  const height = attribute('height') ?? (box === undefined ? 150 : Math.round(box[3] ?? 0));
  return sized(width, height);
}

/**
 * The natural size of a picture, read from its header (068 R6). `null` when the header is cut off
 * or does not hold one: callers refuse then instead of guessing.
 */
export function pictureSize(bytes: Uint8Array, type: AssetType): Size | null {
  switch (type) {
    case 'image/png':
      return pngSize(bytes);
    case 'image/jpeg':
      return jpegSize(bytes);
    case 'image/gif':
      return gifSize(bytes);
    case 'image/webp':
      return webpSize(bytes);
    case 'image/avif':
      return avifSize(bytes);
    case 'image/svg+xml':
      return svgSize(bytes);
  }
}

export type PictureFileEntryRefusal = 'bad-type' | 'too-large' | 'no-size' | PathViolation;

/**
 * A complete `assets` entry for a picture file that stays next to the deck: the id is the SHA-256
 * of the file as it is on disk, and `path` is the caller's relative path. Or the reason it cannot
 * be made (never guesses a size). Pure.
 */
export function pictureFileEntry(
  bytes: Uint8Array,
  name: string,
  path: string,
): { ok: true; id: AssetId; entry: Asset } | { ok: false; reason: PictureFileEntryRefusal } {
  const type = sniffType(bytes);
  if (type === null) return { ok: false, reason: 'bad-type' };
  if (bytes.length > MAX_ASSET_BYTES) return { ok: false, reason: 'too-large' };
  const violation = checkPicturePath(path);
  if (violation !== null) return { ok: false, reason: violation };
  const size = pictureSize(bytes, type);
  if (size === null) return { ok: false, reason: 'no-size' };
  return {
    ok: true,
    id: assetId(bytes),
    entry: { type, bytes: bytes.length, width: size.width, height: size.height, name, path },
  };
}

import type { ImageType } from './limits';

/**
 * The picture type from the first bytes, ignoring the file name and the declared type (a PNG
 * named `.jpg` is a PNG). `null` for anything outside the allow-list (HEIC, BMP, PDF, text...).
 */
export function sniffType(bytes: Uint8Array): ImageType | null {
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

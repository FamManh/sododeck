/**
 * Tiny pictures for the picture-facts tests (068); nothing binary is committed. The real files
 * are a few hundred bytes. The others are built byte by byte to reach header shapes the real
 * ones do not have (EXIF before the JPEG frame, lossy and extended WebP).
 */
const fromBase64 = (text: string): Uint8Array =>
  Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
const ascii = (text: string): number[] => Array.from(text, (char) => char.charCodeAt(0));
const text = (value: string): Uint8Array => new TextEncoder().encode(value);
const le16 = (n: number) => [n & 255, (n >> 8) & 255];
const le24 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];
const le32 = (n: number) => [...le16(n & 0xffff), ...le16(n >>> 16)];
const be16 = (n: number) => [(n >> 8) & 255, n & 255];

export const PNG_1X1 = fromBase64(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
);
export const JPEG_1X1 = fromBase64(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
);
export const WEBP_1X1 = fromBase64('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==');
export const GIF_1X1 = fromBase64('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
export const AVIF_2X2 = fromBase64(
  'AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAAB9tZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=',
);

export const SVG_WITH_SIZE = text(
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20" viewBox="0 0 400 200"></svg>',
);
export const SVG_WITH_VIEWBOX = text(
  '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64.4 48"></svg>',
);
export const SVG_WITH_NEITHER = text('<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>');
export const SVG_WITH_PERCENT = text(
  '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 10 20"></svg>',
);

/** A JPEG whose EXIF segment comes before the frame header: 640 × 480. */
export const JPEG_WITH_EXIF = new Uint8Array([
  0xff,
  0xd8,
  0xff,
  0xe1,
  ...be16(8),
  ...ascii('Exif'),
  0,
  0,
  0xff,
  0xc0,
  ...be16(17),
  8,
  ...be16(480),
  ...be16(640),
  3,
  1,
  0x22,
  0,
  2,
  0x11,
  1,
  3,
  0x11,
  1,
  0xff,
  0xda,
]);

/** Lossy WebP (`VP8 `): 320 × 240. */
export const WEBP_LOSSY = new Uint8Array([
  ...ascii('RIFF'),
  ...le32(30),
  ...ascii('WEBP'),
  ...ascii('VP8 '),
  ...le32(10),
  0x30,
  0x01,
  0x00,
  0x9d,
  0x01,
  0x2a,
  ...le16(320),
  ...le16(240),
]);

/** Extended WebP (`VP8X`): 1000 × 500. */
export const WEBP_EXTENDED = new Uint8Array([
  ...ascii('RIFF'),
  ...le32(30),
  ...ascii('WEBP'),
  ...ascii('VP8X'),
  ...le32(10),
  0,
  0,
  0,
  0,
  ...le24(999),
  ...le24(499),
]);

/** A BMP: not an allowed type. */
export const BMP = text('BM\u0000\u0000\u0000\u0000');

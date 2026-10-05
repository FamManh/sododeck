/**
 * Tiny valid pictures for tests (no binaries are committed). Each is a few hundred bytes at most.
 */
import type { ImageType } from './limits';

const fromBase64 = (text: string): Uint8Array =>
  Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

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

export const SVG_TEXT =
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20" viewBox="0 0 40 20"><rect width="40" height="20" fill="#336699"/></svg>';
export const SVG_BYTES = new TextEncoder().encode(SVG_TEXT);

/** One of each allowed type, keyed by MIME type. */
export const TEST_PICTURES: Record<ImageType, Uint8Array> = {
  'image/png': PNG_1X1,
  'image/jpeg': JPEG_1X1,
  'image/webp': WEBP_1X1,
  'image/gif': GIF_1X1,
  'image/avif': AVIF_2X2,
  'image/svg+xml': SVG_BYTES,
};

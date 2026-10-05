/** Picture limits (055 R5, spec FR). Named so tests, messages and the worker agree. */

/** Longest edge, in pixels, of a stored raster picture; larger ones are scaled down. */
export const MAX_LONG_EDGE = 2048;
/** Largest file accepted from the user. */
export const MAX_INPUT_BYTES = 10 * 1024 * 1024;
/** Largest picture kept in the store and in the file. */
export const MAX_STORED_BYTES = 5 * 1024 * 1024;
/** All pictures of a deck together; above this the app warns once per session. */
export const SOFT_DECK_BYTES = 100 * 1024 * 1024;
/** Smallest side of an image object on the canvas, in canvas units. */
export const MIN_IMAGE_SIZE = 32;
/** Starting JPEG / WebP quality when a picture is re-encoded (tunable, R5). */
export const ENCODE_QUALITY = 0.85;

export const IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/avif',
] as const;

export type ImageType = (typeof IMAGE_TYPES)[number];

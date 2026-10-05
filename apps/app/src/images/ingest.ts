import { chooseSmaller, fitWithin, type PixelSize } from './fit-within';
import { IMAGE_TYPES, MAX_INPUT_BYTES, MAX_STORED_BYTES, type ImageType } from './limits';
import { sanitizeSvg } from './sanitize-svg';
import { sniffType } from './sniff-type';

/**
 * The import pipeline for one picture (055 R5, R6): sniff, check limits, sanitise or decode,
 * scale and re-encode when needed, hash. Pure over three ports so it is tested without a browser;
 * `image-client.ts` supplies worker-backed ports. The SVG sanitiser needs the DOM, so SVG is the
 * one step that always runs on the calling thread.
 */
export interface IngestPorts {
  /** Natural pixel size, or `null` when the browser cannot decode the bytes. */
  decode(bytes: Uint8Array, type: ImageType): Promise<PixelSize | null>;
  /** Scales to `size` and re-encodes. `outputType` is set when the type must change (AVIF). */
  encode(
    bytes: Uint8Array,
    type: ImageType,
    size: PixelSize,
    outputType?: ImageType,
  ): Promise<{ bytes: Uint8Array; type: string }>;
  /** Lowercase hex SHA-256. */
  digest(bytes: Uint8Array): Promise<string>;
}

export interface IngestInput {
  name: string;
  bytes: Uint8Array;
}

export interface IngestedPicture {
  /** SHA-256 of `bytes` (the stored bytes), the asset id. */
  id: string;
  type: ImageType;
  bytes: Uint8Array;
  width: number;
  height: number;
  name: string;
  /** A GIF with several frames: only the first frame shows (FR notice). */
  animated: boolean;
}

export interface IngestRefusal {
  name: string;
  code: 'unsupported-type' | 'too-large' | 'unreadable' | 'unsafe-svg' | 'still-too-large';
  /** The size that broke a limit (`too-large`, `still-too-large`). */
  bytes?: number;
}

export type IngestResult =
  { ok: true; picture: IngestedPicture } | { ok: false; refusal: IngestRefusal };

const refuse = (name: string, code: IngestRefusal['code'], bytes?: number): IngestResult => ({
  ok: false,
  refusal: bytes === undefined ? { name, code } : { name, code, bytes },
});

const isImageType = (type: string): type is ImageType =>
  (IMAGE_TYPES as readonly string[]).includes(type);

/** More than one Graphic Control Extension block means more than one frame. */
export function isAnimatedGif(bytes: Uint8Array): boolean {
  let frames = 0;
  for (let i = 0; i + 2 < bytes.length; i++) {
    if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 0x04 && ++frames > 1) {
      return true;
    }
  }
  return false;
}

async function finish(
  input: IngestInput,
  picture: { type: ImageType; bytes: Uint8Array; width: number; height: number; animated: boolean },
  ports: IngestPorts,
): Promise<IngestResult> {
  if (picture.bytes.length > MAX_STORED_BYTES) {
    return refuse(input.name, 'still-too-large', picture.bytes.length);
  }
  const id = await ports.digest(picture.bytes);
  return { ok: true, picture: { ...picture, id, name: input.name } };
}

async function ingestSvg(input: IngestInput, ports: IngestPorts): Promise<IngestResult> {
  const cleaned = sanitizeSvg(new TextDecoder().decode(input.bytes));
  if (!cleaned.ok) {
    return refuse(input.name, cleaned.reason === 'unreadable' ? 'unreadable' : 'unsafe-svg');
  }
  const bytes = new TextEncoder().encode(cleaned.svg);
  const width = Math.max(1, Math.round(cleaned.width));
  const height = Math.max(1, Math.round(cleaned.height));
  return finish(input, { type: 'image/svg+xml', bytes, width, height, animated: false }, ports);
}

export async function ingestImage(input: IngestInput, ports: IngestPorts): Promise<IngestResult> {
  const { name, bytes } = input;
  if (bytes.length > MAX_INPUT_BYTES) return refuse(name, 'too-large', bytes.length);
  const type = sniffType(bytes);
  if (type === null) return refuse(name, 'unsupported-type');
  if (type === 'image/svg+xml') return ingestSvg(input, ports);

  let natural: PixelSize | null;
  try {
    natural = await ports.decode(bytes, type);
  } catch {
    natural = null;
  }
  if (natural === null || natural.width < 1 || natural.height < 1) {
    return refuse(name, 'unreadable');
  }
  const animated = type === 'image/gif' && isAnimatedGif(bytes);
  const original = { type, bytes, ...natural, animated };
  // A GIF is stored as is: re-encoding would drop its frames.
  if (type === 'image/gif') return finish(input, original, ports);

  const fit = fitWithin(natural.width, natural.height);
  if (!fit.scaled && bytes.length <= MAX_STORED_BYTES) return finish(input, original, ports);

  const outputType = type === 'image/avif' ? 'image/webp' : undefined;
  let encoded: { bytes: Uint8Array; type: string };
  try {
    encoded = await ports.encode(bytes, type, { width: fit.width, height: fit.height }, outputType);
  } catch {
    return refuse(name, 'unreadable');
  }
  const resultType = isImageType(encoded.type) ? encoded.type : type;
  const candidate = {
    type: resultType,
    bytes: encoded.bytes,
    width: fit.width,
    height: fit.height,
    animated,
  };
  return finish(input, chooseSmaller(original, candidate), ports);
}

const MB = 1024 * 1024;
const megabytes = (bytes: number) => `${(bytes / MB).toFixed(1)} MB`;

/** The refusal as the sentence of contracts/ui.md "Messages". */
export function describeRefusal(refusal: IngestRefusal): string {
  const { name, bytes = 0 } = refusal;
  switch (refusal.code) {
    case 'unsupported-type':
      return `${name}: type not supported (use PNG, JPEG, WebP, GIF, SVG or AVIF).`;
    case 'too-large':
      return `${name}: file is ${megabytes(bytes)}; the limit is ${String(MAX_INPUT_BYTES / MB)} MB.`;
    case 'still-too-large':
      return `${name}: still ${megabytes(bytes)} after compression; the limit is ${String(MAX_STORED_BYTES / MB)} MB.`;
    case 'unsafe-svg':
      return `${name}: SVG contains scripts or outside links and was not added.`;
    case 'unreadable':
      return `${name}: could not read this image.`;
  }
}

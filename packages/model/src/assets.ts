/**
 * Pictures (055, ADR 0037). The document holds an `images` collection and `meta.assets` (type,
 * stored size, pixel size, name per picture id); the picture bytes live outside it, in the app's
 * blob store, keyed by the same id. A picture id is the lowercase SHA-256 of the stored bytes, so a
 * blob can never drift from the document that names it.
 *
 * This module is the only place that turns bytes into file `data` and back:
 * - `loadDeck` (deck.ts) calls `repairAssets` on a file's `assets` before validation: an entry
 *   whose data is damaged becomes a placeholder entry and a problem, so the deck opens with a
 *   "picture missing" placeholder instead of being refused (contracts/file-format.md).
 * - `attachAssets` fills `assets[id].data` from a byte map when a deck is written to a file.
 * The hash is a small synchronous SHA-256 here so the model stays free of platform crypto (the
 * app hashes in a worker with `crypto.subtle`; both give the same id).
 */
import type { Asset, AssetType, Id, SododeckFile } from '@sododeck/schema';

import { isRecord } from './convert';

/** Picture id: lowercase hex SHA-256 of the stored bytes. */
export type AssetId = string;

/** What the document stores about a picture; the bytes are kept elsewhere. */
export type AssetMeta = Omit<Asset, 'data'>;

/** Picture bytes by picture id: what the blob store holds for one deck. */
export type AssetBytes = ReadonlyMap<AssetId, Uint8Array>;

/** Most bytes a stored picture may hold (the schema's `maximum`). */
export const MAX_ASSET_BYTES = 5_242_880;

/** The six picture types a deck accepts, as in v1.json. */
export const ASSET_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/avif',
] as const satisfies readonly AssetType[];

/**
 * `data` written for a picture whose bytes are not at hand (never stored, or a deck pasted from
 * another deck). One zero byte: valid base64 that fails the hash check on import, so the picture
 * comes back as missing again instead of showing wrong bytes.
 */
export const MISSING_DATA = 'AA==';

export type AssetProblemReason =
  'bad-data' | 'size-mismatch' | 'too-large' | 'bad-type' | 'hash-mismatch';

/** A picture of a loaded file that cannot be used: it is shown as missing. */
export interface AssetProblem {
  /** The picture id (the key in the file's `assets`). */
  id: AssetId;
  /** The original file name when the entry had one. */
  name?: string;
  reason: AssetProblemReason;
}

// SHA-256 (FIPS 180-4).
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Lowercase hex SHA-256 of `bytes`: the picture id. */
export function assetId(bytes: Uint8Array): AssetId {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const length = bytes.length;
  // Message, a 1 bit, zero padding and the 64-bit bit length, in whole 64-byte blocks.
  const blocks = Math.ceil((length + 9) / 64);
  const w = new Uint32Array(64);
  const tail = new Uint8Array(blocks * 64 - Math.floor(length / 64) * 64);
  tail.set(bytes.subarray(Math.floor(length / 64) * 64));
  tail[length % 64] = 0x80;
  const view = new DataView(tail.buffer);
  const bitLength = length * 8;
  view.setUint32(tail.length - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(tail.length - 4, bitLength >>> 0);

  const compress = (chunk: DataView, at: number) => {
    for (let i = 0; i < 16; i++) w[i] = chunk.getUint32(at + i * 4);
    for (let i = 16; i < 64; i++) {
      const w15 = w[i - 15] as number;
      const w2 = w[i - 2] as number;
      const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
      const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
      w[i] = ((w[i - 16] as number) + s0 + (w[i - 7] as number) + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h as unknown as number[] as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + (K[i] as number) + (w[i] as number)) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] = ((h[0] as number) + a) | 0;
    h[1] = ((h[1] as number) + b) | 0;
    h[2] = ((h[2] as number) + c) | 0;
    h[3] = ((h[3] as number) + d) | 0;
    h[4] = ((h[4] as number) + e) | 0;
    h[5] = ((h[5] as number) + f) | 0;
    h[6] = ((h[6] as number) + g) | 0;
    h[7] = ((h[7] as number) + hh) | 0;
  };

  // The whole 64-byte blocks of the input are hashed in place; only the tail is copied.
  const whole = Math.floor(length / 64);
  const source = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let block = 0; block < whole; block++) compress(source, block * 64);
  for (let at = 0; at < tail.length; at += 64) compress(view, at);
  return Array.from(h, (word) => (word >>> 0).toString(16).padStart(8, '0')).join('');
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const DECODE = new Int16Array(128).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) DECODE[ALPHABET.charCodeAt(i)] = i;

/** Base64 (no line breaks, `=` padded) of `bytes`. */
export function encodeBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  const CHUNK = 3 * 8192;
  for (let start = 0; start < bytes.length; start += CHUNK) {
    let out = '';
    const end = Math.min(bytes.length, start + CHUNK);
    for (let i = start; i < end; i += 3) {
      const a = bytes[i] as number;
      const b = i + 1 < bytes.length ? (bytes[i + 1] as number) : 0;
      const c = i + 2 < bytes.length ? (bytes[i + 2] as number) : 0;
      out += ALPHABET.charAt(a >> 2) + ALPHABET.charAt(((a & 3) << 4) | (b >> 4));
      out += i + 1 < bytes.length ? ALPHABET.charAt(((b & 15) << 2) | (c >> 6)) : '=';
      out += i + 2 < bytes.length ? ALPHABET.charAt(c & 63) : '=';
    }
    parts.push(out);
  }
  return parts.join('');
}

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** The bytes of padded base64, or undefined when `text` is not valid base64. */
export function decodeBase64(text: string): Uint8Array | undefined {
  if (text.length % 4 !== 0 || !BASE64.test(text)) return undefined;
  const padding = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((text.length / 4) * 3 - padding);
  let at = 0;
  for (let i = 0; i < text.length; i += 4) {
    const n0 = DECODE[text.charCodeAt(i)] as number;
    const n1 = DECODE[text.charCodeAt(i + 1)] as number;
    const n2 = text.charAt(i + 2) === '=' ? 0 : (DECODE[text.charCodeAt(i + 2)] as number);
    const n3 = text.charAt(i + 3) === '=' ? 0 : (DECODE[text.charCodeAt(i + 3)] as number);
    const word = (n0 << 18) | (n1 << 12) | (n2 << 6) | n3;
    out[at++] = (word >> 16) & 255;
    if (at < out.length) out[at++] = (word >> 8) & 255;
    if (at < out.length) out[at++] = word & 255;
  }
  return out;
}

/** The part of an asset the document stores (no `data`). */
export function metaOf(asset: Asset | AssetMeta): AssetMeta {
  return {
    type: asset.type,
    bytes: asset.bytes,
    width: asset.width,
    height: asset.height,
    name: asset.name,
  };
}

const positiveInt = (value: unknown): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : 1;

function isAssetType(value: unknown): value is AssetType {
  return typeof value === 'string' && (ASSET_TYPES as readonly string[]).includes(value);
}

/**
 * Checks the data of every entry of a file's `assets` and returns the file with each damaged
 * entry replaced by a placeholder the schema accepts (one zero byte, `MISSING_DATA`), the bytes of
 * the sound ones, and one problem per damaged entry. Entries that are not even objects, and every
 * other part of the file, are left for the schema to judge. `input` is not changed.
 */
export function repairAssets(input: unknown): {
  input: unknown;
  bytes: Map<AssetId, Uint8Array>;
  problems: AssetProblem[];
} {
  const bytes = new Map<AssetId, Uint8Array>();
  const problems: AssetProblem[] = [];
  if (!isRecord(input) || !isRecord(input.assets)) return { input, bytes, problems };

  const assets: Record<string, unknown> = {};
  for (const [id, entry] of Object.entries(input.assets)) {
    if (!isRecord(entry) || typeof entry.data !== 'string') {
      assets[id] = entry;
      continue;
    }
    const reason = ((): AssetProblemReason | undefined => {
      if (!isAssetType(entry.type)) return 'bad-type';
      const decoded = decodeBase64(entry.data);
      if (decoded === undefined) return 'bad-data';
      if (decoded.length > MAX_ASSET_BYTES) return 'too-large';
      if (decoded.length !== entry.bytes) return 'size-mismatch';
      if (decoded.length === 0 || assetId(decoded) !== id) return 'hash-mismatch';
      bytes.set(id, decoded);
      return undefined;
    })();
    if (reason === undefined) {
      assets[id] = entry;
      continue;
    }
    problems.push({
      id,
      ...(typeof entry.name === 'string' ? { name: entry.name } : {}),
      reason,
    });
    assets[id] = {
      type: isAssetType(entry.type) ? entry.type : 'image/png',
      bytes: 1,
      width: positiveInt(entry.width),
      height: positiveInt(entry.height),
      name: typeof entry.name === 'string' ? entry.name : '',
      data: MISSING_DATA,
    };
  }
  return { input: { ...input, assets }, bytes, problems };
}

/** Picture ids that the file's images use. */
export function usedAssetIds(file: Pick<SododeckFile, 'images'>): Set<AssetId> {
  return new Set((file.images ?? []).map((image) => image.asset));
}

/**
 * The file as it is written to disk: `assets` holds one entry per picture an image uses, in id
 * order, each with its base64 `data` from `bytes`. A picture without bytes keeps the data it
 * already carries (a file just parsed), else gets `MISSING_DATA`. Pictures no image uses are
 * dropped (rule I2), and a deck without images has neither `images` nor `assets`.
 */
export function attachAssets(file: SododeckFile, bytes?: AssetBytes): SododeckFile {
  const { images, assets: stored, ...rest } = file;
  if (images === undefined || images.length === 0) return rest;
  const assets: Record<Id, Asset> = {};
  for (const id of [...usedAssetIds(file)].sort()) {
    const meta = stored?.[id];
    if (meta === undefined) continue;
    const picture = bytes?.get(id);
    if (picture !== undefined) {
      assets[id] = { ...metaOf(meta), bytes: picture.length, data: encodeBase64(picture) };
    } else if (meta.data !== '') {
      assets[id] = meta;
    } else {
      assets[id] = { ...metaOf(meta), bytes: 1, data: MISSING_DATA };
    }
  }
  return { ...rest, images, assets };
}

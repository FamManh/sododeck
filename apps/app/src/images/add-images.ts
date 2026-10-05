import { defaultImageSize, type DeckEditor, type NewImage } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

import { isQuotaError } from '../lib/features';
import { readDeck } from '../model/use-deck-snapshot';
import { describeRefusal, ingestImage, type IngestedPicture, type IngestPorts } from './ingest';
import { blockSize, layoutRow } from './layout-row';
import { SOFT_DECK_BYTES } from './limits';
import type { PictureStore } from './picture-store';

export interface AddImagesInput {
  editor: DeckEditor;
  /** Where the picture bytes go. `null` (no store) adds nothing. */
  store: PictureStore | null;
  ports: IngestPorts;
  /** The canvas point the added block is centred on: the pointer, the drop point or the view centre. */
  at: { x: number; y: number };
  /** The visible canvas width in canvas units: caps each picture and where a row wraps. */
  viewportWidth: number;
  /** A group the images join (the frame a picture is dropped into). */
  group?: string;
}

export interface AddImagesResult {
  /** Ids of the images added, in file order; empty when nothing was added. */
  ids: string[];
  /** Messages for the toast list: refusals and notes first, the summary last. */
  messages: string[];
}

/** Reads a dropped, pasted or picked file; `File.arrayBuffer` is missing in some test runtimes. */
export async function readFileBytes(file: Blob): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') return new Uint8Array(await file.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(new Uint8Array(reader.result as ArrayBuffer));
    };
    reader.onerror = () => {
      reject(reader.error instanceof Error ? reader.error : new Error('Could not read the file'));
    };
    reader.readAsArrayBuffer(file);
  });
}

let softLimitWarned = false;

/** Tests: the warning shows once per session, so a test that wants it again resets it. */
export function resetSoftLimitWarning(): void {
  softLimitWarned = false;
}

/** The bytes of the pictures the deck's images use, each counted once. */
export function pictureBytesOf(deck: Pick<SododeckFile, 'images' | 'assets'>): number {
  const used = new Set((deck.images ?? []).map((image) => image.asset));
  let total = 0;
  for (const id of used) total += deck.assets?.[id]?.bytes ?? 0;
  return total;
}

const plural = (n: number) => (n === 1 ? '1 image' : `${String(n)} images`);

/**
 * Adds pictures to the canvas (055 US1, US2): each file is checked and compressed by the ingest
 * pipeline, the accepted pictures are written to the store, and only then are the image objects
 * added, all in one undo step. A refused file never blocks the others; a store failure adds
 * nothing, so the document never names a picture that was not kept.
 */
export async function addImages(
  input: AddImagesInput,
  files: readonly File[],
): Promise<AddImagesResult> {
  const { editor, store, ports, at, viewportWidth, group } = input;
  const messages: string[] = [];
  const pictures: IngestedPicture[] = [];
  for (const file of files) {
    let bytes: Uint8Array;
    try {
      bytes = await readFileBytes(file);
    } catch {
      messages.push(`${file.name}: could not read this image.`);
      continue;
    }
    const result = await ingestImage({ name: file.name, bytes }, ports);
    if (!result.ok) {
      messages.push(describeRefusal(result.refusal));
      continue;
    }
    if (result.picture.animated) {
      messages.push(`${file.name}: animated GIFs show only the first frame.`);
    }
    pictures.push(result.picture);
  }
  if (pictures.length === 0) return { ids: [], messages };
  if (store === null) {
    return { ids: [], messages: [...messages, 'Could not save the picture.'] };
  }

  try {
    for (const picture of pictures) {
      await store.put(picture.id, { type: picture.type, bytes: picture.bytes });
    }
  } catch (error) {
    const reason = isQuotaError(error) ? ': browser storage is full' : '';
    return { ids: [], messages: [...messages, `Could not save the picture${reason}.`] };
  }

  const sizes = pictures.map((picture) =>
    defaultImageSize({ width: picture.width, height: picture.height }, viewportWidth),
  );
  const block = blockSize(sizes, viewportWidth);
  const origin = { x: Math.round(at.x - block.width / 2), y: Math.round(at.y - block.height / 2) };
  const points = layoutRow(sizes, origin, viewportWidth);
  const items: NewImage[] = pictures.map((picture, index) => ({
    asset: picture.id,
    meta: {
      type: picture.type,
      bytes: picture.bytes.length,
      width: picture.width,
      height: picture.height,
      name: picture.name,
    },
    position: points[index] ?? origin,
    size: sizes[index] ?? { width: 32, height: 32 },
    ...(group === undefined ? {} : { group }),
  }));
  const ids = editor.addImages(items);
  const summary = `Added ${plural(ids.length)}.`;
  // One quiet warning per session once the pictures pass the soft limit (the add itself is fine).
  const total = pictureBytesOf(readDeck(editor.doc));
  if (total > SOFT_DECK_BYTES && !softLimitWarned) {
    softLimitWarned = true;
    const warning = `Pictures in this deck use ${String(Math.round(total / 1024 / 1024))} MB. Large decks may be slow to open.`;
    return { ids, messages: [...messages, warning, summary] };
  }
  return { ids, messages: [...messages, summary] };
}

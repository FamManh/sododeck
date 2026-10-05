import type { PixelSize } from './fit-within';
import type { IngestPorts } from './ingest';
import { ENCODE_QUALITY, type ImageType } from './limits';

/**
 * Browser implementations of the ingest ports (055 R5): decode with `createImageBitmap`, scale and
 * encode on a canvas, SHA-256 with `crypto.subtle`. The worker runs them off the main thread; the
 * inline client runs the same code on the main thread when workers or `OffscreenCanvas` are
 * missing, then falls back to an `<img>` and an `HTMLCanvasElement`. Needs real browser APIs, so
 * it is exercised by the app and the benchmark, not by unit tests.
 */

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
type Source = ImageBitmap | HTMLImageElement;

async function load(
  bytes: Uint8Array,
  type: ImageType,
): Promise<{ source: Source; close: () => void }> {
  const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type });
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    return {
      source: bitmap,
      close: () => {
        bitmap.close();
      },
    };
  }
  const url = URL.createObjectURL(blob);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => {
        resolve();
      };
      image.onerror = () => {
        reject(new Error('Image failed to load'));
      };
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
  return { source: image, close: () => undefined };
}

// Duck-typed, not `instanceof`: a worker has no `HTMLImageElement` or `HTMLCanvasElement`, and
// naming them there throws a ReferenceError.
export const sourceSize = (source: Source): PixelSize =>
  'naturalWidth' in source
    ? { width: source.naturalWidth, height: source.naturalHeight }
    : { width: source.width, height: source.height };

function makeCanvas({ width, height }: PixelSize): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function canvasToBlob(canvas: AnyCanvas, type: string, quality: number): Promise<Blob> {
  if ('toBlob' in canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas could not encode the picture'));
        },
        type,
        quality,
      );
    });
  }
  return canvas.convertToBlob({ type, quality });
}

export function createBrowserOps(): IngestPorts {
  return {
    async decode(bytes, type) {
      try {
        const { source, close } = await load(bytes, type);
        const size = sourceSize(source);
        close();
        return size.width > 0 && size.height > 0 ? size : null;
      } catch {
        return null;
      }
    },

    async encode(bytes, type, size, outputType) {
      const { source, close } = await load(bytes, type);
      try {
        const canvas = makeCanvas(size);
        const context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null =
          canvas.getContext('2d');
        if (context === null) throw new Error('No 2D canvas context');
        context.imageSmoothingQuality = 'high';
        context.drawImage(source, 0, 0, size.width, size.height);
        const blob = await canvasToBlob(canvas, outputType ?? type, ENCODE_QUALITY);
        return { bytes: new Uint8Array(await blob.arrayBuffer()), type: blob.type };
      } finally {
        close();
      }
    },

    async digest(bytes) {
      const hash = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
      return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join(
        '',
      );
    },
  };
}

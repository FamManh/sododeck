import { copyItem, copyText } from '../../lib/clipboard';
import { clipboardItemSupports, supportsClipboardItems } from '../../lib/features';
import type { RenderedImage } from './render-image';
import { rasterize } from './rasterize';
import type { PngScale } from './types';

/** Marks a derived promise handled when the browser never asks for it (a type it left out). */
function settled<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => undefined);
  return promise;
}

/**
 * Copies a rendered picture (the Export dialog's Copy and the canvas menu's Copy as PNG / SVG).
 * `image` may still be rendering: the clipboard item is created at once, inside the user's
 * gesture, and filled when it settles.
 *
 * - PNG: one `image/png` item rasterised at `scale`, like Download.
 * - SVG: the markup as `text/plain` (pastes into code and text fields), plus `image/svg+xml` in
 *   the same item where `ClipboardItem.supports` says the browser takes it. Without clipboard items
 *   (or when the write is refused) it falls back to plain text.
 *
 * Resolves `false` when nothing reached the clipboard; never throws. Nothing leaves the browser.
 */
export async function copyImage(
  format: 'png' | 'svg',
  image: Promise<RenderedImage>,
  scale: PngScale = 2,
): Promise<boolean> {
  if (format === 'png') {
    return copyItem({
      'image/png': settled(image.then(({ svg, bounds }) => rasterize(svg, bounds, scale))),
    });
  }
  if (supportsClipboardItems()) {
    const blob = (type: string) => settled(image.then(({ svg }) => new Blob([svg], { type })));
    const written = await copyItem({
      'text/plain': blob('text/plain'),
      ...(clipboardItemSupports('image/svg+xml') ? { 'image/svg+xml': blob('image/svg+xml') } : {}),
    });
    if (written) return true;
  }
  try {
    return await copyText((await image).svg);
  } catch {
    return false;
  }
}

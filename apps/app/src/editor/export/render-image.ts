import type { SododeckFile } from '@sododeck/schema';
import { EMBEDDED_FONT_CSS } from '@sododeck/ui/lib/embedded-fonts';

import type { PictureStore } from '../../images/picture-store';
import { ensureFontsLoaded } from './export-fonts';
import { exportPaletteFor } from './export-palette';
import { pictureDataUris } from './picture-data-uris';
import { renderSvg } from './render-svg';
import { buildScene, type SceneInput, type SceneScope } from './scene';
import { canvasMeasurer, fixedWidthMeasurer } from './text-measure';

/** A rendered picture: the SVG file and its size in diagram units (PNG scales from it). */
export interface RenderedImage {
  svg: string;
  bounds: { width: number; height: number };
}

export interface RenderImageInput {
  deck: SododeckFile;
  scope: SceneScope;
  ui: SceneInput['ui'];
  transparent: boolean;
  store: PictureStore | null;
}

/**
 * The one image path (012, ADR 0016): scene → SVG with embedded fonts and pictures, in the light
 * palette with the deck's canvas colour (ADR 0044). The Export dialog's preview, Download and Copy and the canvas menu's Copy as PNG / SVG
 * all go through it. Null when the scope draws nothing. Runs in the browser; nothing is uploaded.
 */
export async function renderImage({
  deck,
  scope,
  ui,
  transparent,
  store,
}: RenderImageInput): Promise<RenderedImage | null> {
  await ensureFontsLoaded();
  const scene = buildScene({ deck, scope, ui });
  if (scene.bounds.width === 0 || scene.bounds.height === 0) return null;
  // The pictures go in as `data:` URIs, read before rendering: the SVG alone shows them and the
  // PNG rasteriser (an SVG drawn as an `<img>`) loads nothing else (055 R6).
  const pictures = scene.images.length === 0 ? undefined : await pictureDataUris(store, deck);
  const svg = renderSvg(scene, {
    ...(pictures === undefined ? {} : { pictures }),
    transparent,
    palette: exportPaletteFor(deck),
    fonts: EMBEDDED_FONT_CSS,
    measure: canvasMeasurer() ?? fixedWidthMeasurer(),
    title: deck.name ?? 'Untitled deck',
  });
  return { svg, bounds: { width: scene.bounds.width, height: scene.bounds.height } };
}

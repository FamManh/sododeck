import type { SododeckFile } from '@sododeck/schema';
import { EMBEDDED_FONT_CSS } from '@sododeck/ui/lib/embedded-fonts';
import { useEffect, type Dispatch } from 'react';

import { usePictureStore } from '../../images/picture-store';
import { readPictureBytes } from '../../images/read-pictures';
import { schemaExport, schemaFileName } from '../../db/export/schema-export';
import type { SchemaExportRequest } from '../../db/export/types';
import type { ExportAction, ExportDialogState, ExportResult } from './export-dialog-state';
import { exportFileName, formatBytes } from './export-file-name';
import { ensureFontsLoaded } from './export-fonts';
import { exportPaletteFor } from './export-palette';
import { jsonExport } from './json-export';
import { largestScale, pngSize } from './png-size';
import { renderSvg } from './render-svg';
import { pictureDataUris } from './picture-data-uris';
import { buildScene, type SceneInput } from './scene';
import { canvasMeasurer, fixedWidthMeasurer } from './text-measure';
import { isSchemaFormat, type PngScale } from './types';

type ExportUi = SceneInput['ui'];

/** The deck snapshot's identity: `useDeckSnapshot` hands out a new object on every change. */
const snapshots = new WeakMap<SododeckFile, number>();
let nextSnapshot = 0;

function snapshotId(deck: SododeckFile): number {
  let id = snapshots.get(deck);
  if (id === undefined) {
    id = ++nextSnapshot;
    snapshots.set(deck, id);
  }
  return id;
}

/**
 * A schema format's request as the dialog resolved it (045): table ids of the scope, the dialect
 * and the SQL options; `dialect: null` with `needsDialect` is SQL of a Generic deck still waiting.
 */
export interface SchemaRequest {
  request: SchemaExportRequest;
  /** The database card's title, for the file name. */
  scopeTitle: string | null;
  needsDialect: boolean;
}

/** What one generation depends on, besides the deck and the UI values. */
export interface ExportRequest {
  format: ExportDialogState['format'];
  imageScope: ExportDialogState['imageScope'];
  json: ExportDialogState['options']['json'];
  transparent: boolean;
  retryCount: number;
  /** Set for schema formats only. */
  schema: SchemaRequest | null;
}

export function exportRequest(
  state: ExportDialogState,
  schema: SchemaRequest | null = null,
): ExportRequest {
  const { format, imageScope, options, retryCount } = state;
  return {
    format,
    imageScope,
    json: options.json,
    transparent: format === 'png' ? options.png.transparent : options.svg.transparent,
    retryCount,
    schema: isSchemaFormat(format) ? schema : null,
  };
}

/**
 * Identifies one generation request; a result settled under another key is stale and dropped.
 * The PNG scale is not part of it: the preview SVG does not depend on the scale, and the footer
 * derives the pixel size from the result's bounds.
 */
export function exportRequestKey(request: ExportRequest, deck: SododeckFile, ui: ExportUi): string {
  const { format, imageScope } = request;
  const scopeUi =
    imageScope === 'deck'
      ? null
      : [ui.currentViewId, [...ui.revealed].sort(), ui.drill, ui.activeFlowId];
  const settings = isSchemaFormat(format)
    ? request.schema
    : format === 'json'
      ? request.json
      : [imageScope, request.transparent, scopeUi, ui.labelsOn === true];
  return JSON.stringify([snapshotId(deck), format, settings, request.retryCount]);
}

export function pngSizeHint(bounds: { width: number; height: number }, scale: PngScale): string {
  const { width, height } = pngSize(bounds, scale);
  return `${width} × ${height} px`;
}

function jsonResult(
  deck: SododeckFile,
  options: ExportDialogState['options']['json'],
  pictures: ReadonlyMap<string, Uint8Array>,
) {
  const { text, bytes } = jsonExport(deck, options, pictures);
  return {
    fileName: exportFileName(deck.name, null, 'json'),
    sizeHint: formatBytes(bytes),
    text,
    svg: null,
    bounds: null,
    notes: [],
  } satisfies ExportResult;
}

function schemaResult(deck: SododeckFile, schema: SchemaRequest): ExportResult | 'empty' {
  const { text, notes, tableCount } = schemaExport(deck, schema.request);
  if (tableCount === 0) return 'empty';
  return {
    fileName: schemaFileName(deck, schema.request, schema.scopeTitle),
    sizeHint: formatBytes(new TextEncoder().encode(text).byteLength),
    text,
    svg: null,
    bounds: null,
    notes,
  };
}

/**
 * Generates the preview for the dialog's current request after a 150 ms debounce, on the main
 * thread (ADR 0016: the budget is < 50 ms for 500 components). Stale results are dropped by key.
 */
export function useExportResult(
  request: ExportRequest,
  dispatch: Dispatch<ExportAction>,
  deck: SododeckFile,
  ui: ExportUi,
): void {
  const { format, imageScope, json, transparent, retryCount, schema } = request;
  const store = usePictureStore();
  useEffect(() => {
    const key = exportRequestKey(
      { format, imageScope, json, transparent, retryCount, schema },
      deck,
      ui,
    );
    let cancelled = false;
    dispatch({ type: 'preparing', key });
    if (schema?.needsDialect === true) {
      dispatch({ type: 'settled', key, result: 'needs-dialect' });
      return;
    }
    const generate = async (): Promise<ExportResult | 'empty'> => {
      if (format === 'json') return jsonResult(deck, json, await readPictureBytes(store, deck));
      // Text built on the main thread: < 50 ms for 150 tables (045 research R2, perf test).
      if (schema !== null) return schemaResult(deck, schema);
      await ensureFontsLoaded();
      const scene = buildScene({ deck, scope: imageScope, ui });
      if (scene.bounds.width === 0 || scene.bounds.height === 0) return 'empty';
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
      const flow =
        imageScope === 'flow'
          ? deck.flows.find((entry) => entry.id === ui.activeFlowId)
          : undefined;
      return {
        fileName: exportFileName(deck.name, flow?.title ?? null, format),
        // PNG: the dialog shows `pngSizeHint(bounds, scale)` for the scale currently chosen.
        sizeHint: format === 'png' ? '' : formatBytes(new TextEncoder().encode(svg).byteLength),
        text: format === 'svg' ? svg : null,
        svg,
        bounds: { width: scene.bounds.width, height: scene.bounds.height },
        notes: [],
      };
    };
    const timer = window.setTimeout(() => {
      generate().then(
        (result) => {
          if (cancelled) return;
          // Bounds can outgrow the chosen scale while the dialog is open (live sync).
          if (result !== 'empty' && result.bounds !== null) {
            dispatch({ type: 'clampScale', max: largestScale(result.bounds) });
          }
          dispatch({ type: 'settled', key, result });
        },
        () => {
          if (!cancelled) dispatch({ type: 'settled', key, result: 'error' });
        },
      );
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [deck, ui, format, imageScope, json, transparent, retryCount, schema, dispatch, store]);
}

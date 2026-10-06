import type { SododeckFile } from '@sododeck/schema';
import { useEffect, type Dispatch } from 'react';

import { usePictureStore } from '../../images/picture-store';
import { readPictureBytes } from '../../images/read-pictures';
import { schemaExport, schemaFileName } from '../../db/export/schema-export';
import type { SchemaExportRequest } from '../../db/export/types';
import type { ExportAction, ExportDialogState, ExportResult } from './export-dialog-state';
import { exportFileName, formatBytes } from './export-file-name';
import { jsonExport } from './json-export';
import { largestScale, pngSize } from './png-size';
import { renderImage } from './render-image';
import type { SceneInput } from './scene';
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
      : [
          ui.currentViewId,
          [...ui.revealed].sort(),
          ui.drill,
          imageScope === 'selection' ? (ui.selection ?? null) : null,
        ];
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
      const image = await renderImage({ deck, scope: imageScope, ui, transparent, store });
      if (image === null) return 'empty';
      const { svg, bounds } = image;
      return {
        fileName: exportFileName(
          deck.name,
          imageScope === 'selection' ? 'selection' : null,
          format,
        ),
        // PNG: the dialog shows `pngSizeHint(bounds, scale)` for the scale currently chosen.
        sizeHint: format === 'png' ? '' : formatBytes(new TextEncoder().encode(svg).byteLength),
        text: format === 'svg' ? svg : null,
        svg,
        bounds,
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

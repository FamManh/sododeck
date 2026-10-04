import type { ExportNote } from '../../db/export/notes';
import { DEFAULT_SQL_OPTIONS, type SqlDialect, type SqlOptions } from '../../db/export/types';
import type { ExportFormat, ImageScope, PngScale, SchemaScope } from './types';

export interface ExportOptions {
  json: { includeKnowledge: boolean; pretty: boolean };
  png: { scale: PngScale; transparent: boolean };
  svg: { transparent: boolean };
  sql: SqlOptions;
}

export interface ExportResult {
  fileName: string;
  sizeHint: string;
  text: string | null;
  svg: string | null;
  bounds: { width: number; height: number } | null;
  /** What a schema writer skipped or changed (045); empty for JSON / PNG / SVG. */
  notes: readonly ExportNote[];
}

export type ExportResultState =
  /** `needs-dialect`: SQL of a Generic deck waits until a dialect is picked (045). */
  | { status: 'preparing' | 'empty' | 'error' | 'needs-dialect'; key: string }
  | { status: 'ready'; key: string; result: ExportResult };

export interface ExportDialogState {
  format: ExportFormat;
  imageScope: ImageScope;
  /** Scope of the schema formats; the image formats keep `imageScope`. */
  schemaScope: SchemaScope;
  /** The dialect picked for SQL on a Generic deck, for this dialog session only. */
  sqlDialect: SqlDialect | null;
  flowAvailable: boolean;
  options: ExportOptions;
  scopeNote: 'flow-deleted' | null;
  result: ExportResultState;
  retryCount: number;
}

export type ExportAction =
  | { type: 'format'; format: ExportFormat }
  | { type: 'scope'; scope: ImageScope }
  | { type: 'schemaScope'; scope: SchemaScope }
  | { type: 'sqlDialect'; dialect: SqlDialect }
  | {
      type: 'option';
      options: Partial<{
        json: Partial<ExportOptions['json']>;
        png: Partial<ExportOptions['png']>;
        svg: Partial<ExportOptions['svg']>;
        sql: Partial<ExportOptions['sql']>;
      }>;
    }
  | { type: 'flowGone' }
  | { type: 'clampScale'; max: PngScale | null }
  | { type: 'preparing'; key: string }
  | { type: 'settled'; key: string; result: ExportResult | 'empty' | 'error' | 'needs-dialect' }
  | { type: 'retry' };

export function initialExportState({
  flowMode,
  schemaScope = 'deck',
}: {
  flowMode: boolean;
  /** The first available schema scope when the dialog opens (045 FR-002). */
  schemaScope?: SchemaScope;
}): ExportDialogState {
  return {
    format: flowMode ? 'png' : 'json',
    imageScope: flowMode ? 'flow' : 'deck',
    schemaScope,
    sqlDialect: null,
    flowAvailable: flowMode,
    options: {
      json: { includeKnowledge: true, pretty: true },
      png: { scale: 2, transparent: false },
      svg: { transparent: false },
      sql: DEFAULT_SQL_OPTIONS,
    },
    scopeNote: null,
    result: { status: 'preparing', key: '' },
    retryCount: 0,
  };
}

export function exportReducer(state: ExportDialogState, action: ExportAction): ExportDialogState {
  switch (action.type) {
    case 'format':
      return { ...state, format: action.format };
    case 'scope':
      if (action.scope === 'flow' && !state.flowAvailable) return state;
      return { ...state, imageScope: action.scope, scopeNote: null };
    case 'schemaScope':
      return { ...state, schemaScope: action.scope };
    case 'sqlDialect':
      return { ...state, sqlDialect: action.dialect };
    case 'option': {
      // Only the touched format's options get a new identity, so its generation alone re-runs.
      const { json, png, svg, sql } = action.options;
      const current = state.options;
      return {
        ...state,
        options: {
          json: json === undefined ? current.json : { ...current.json, ...json },
          png: png === undefined ? current.png : { ...current.png, ...png },
          svg: svg === undefined ? current.svg : { ...current.svg, ...svg },
          sql: sql === undefined ? current.sql : { ...current.sql, ...sql },
        },
      };
    }
    case 'flowGone':
      return { ...state, flowAvailable: false, imageScope: 'deck', scopeNote: 'flow-deleted' };
    case 'clampScale':
      return action.max !== null && state.options.png.scale > action.max
        ? {
            ...state,
            options: { ...state.options, png: { ...state.options.png, scale: action.max } },
          }
        : state;
    case 'preparing':
      return { ...state, result: { status: 'preparing', key: action.key } };
    case 'settled':
      if (action.key !== state.result.key) return state;
      return {
        ...state,
        result:
          typeof action.result === 'string'
            ? { status: action.result, key: action.key }
            : { status: 'ready', key: action.key, result: action.result },
      };
    case 'retry':
      return {
        ...state,
        retryCount: state.retryCount + 1,
        result: { status: 'preparing', key: state.result.key },
      };
  }
}

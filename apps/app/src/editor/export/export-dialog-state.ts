import type { ExportFormat, ImageScope, PngScale } from './types';

export interface ExportOptions {
  json: { includeKnowledge: boolean; pretty: boolean };
  png: { scale: PngScale; transparent: boolean };
  svg: { transparent: boolean };
}

export interface ExportResult {
  fileName: string;
  sizeHint: string;
  text: string | null;
  svg: string | null;
  bounds: { width: number; height: number } | null;
}

export type ExportResultState =
  | { status: 'preparing' | 'empty' | 'error'; key: string }
  | { status: 'ready'; key: string; result: ExportResult };

export interface ExportDialogState {
  format: ExportFormat;
  imageScope: ImageScope;
  flowAvailable: boolean;
  options: ExportOptions;
  scopeNote: 'flow-deleted' | null;
  result: ExportResultState;
  retryCount: number;
}

export type ExportAction =
  | { type: 'format'; format: ExportFormat }
  | { type: 'scope'; scope: ImageScope }
  | {
      type: 'option';
      options: Partial<{
        json: Partial<ExportOptions['json']>;
        png: Partial<ExportOptions['png']>;
        svg: Partial<ExportOptions['svg']>;
      }>;
    }
  | { type: 'flowGone' }
  | { type: 'clampScale'; max: PngScale | null }
  | { type: 'preparing'; key: string }
  | { type: 'settled'; key: string; result: ExportResult | 'empty' | 'error' }
  | { type: 'retry' };

export function initialExportState({ flowMode }: { flowMode: boolean }): ExportDialogState {
  return {
    format: flowMode ? 'png' : 'json',
    imageScope: flowMode ? 'flow' : 'deck',
    flowAvailable: flowMode,
    options: {
      json: { includeKnowledge: true, pretty: true },
      png: { scale: 2, transparent: false },
      svg: { transparent: false },
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
    case 'option': {
      // Only the touched format's options get a new identity, so its generation alone re-runs.
      const { json, png, svg } = action.options;
      const current = state.options;
      return {
        ...state,
        options: {
          json: json === undefined ? current.json : { ...current.json, ...json },
          png: png === undefined ? current.png : { ...current.png, ...png },
          svg: svg === undefined ? current.svg : { ...current.svg, ...svg },
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
          action.result === 'empty' || action.result === 'error'
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

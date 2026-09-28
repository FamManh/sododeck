import type { ExportDialog } from './export-dialog';

let loaded: typeof ExportDialog | null = null;

/**
 * Loads the Export dialog chunk (dialog, renderer, embedded fonts). The editor calls it when idle
 * so the dialog opens at once (012 SC-003).
 */
export function preloadExportDialog(): Promise<{ default: typeof ExportDialog }> {
  return import('./export-dialog').then((module) => {
    loaded = module.ExportDialog;
    return { default: module.ExportDialog };
  });
}

/** The dialog component once its chunk has loaded, else `null`. */
export function loadedExportDialog(): typeof ExportDialog | null {
  return loaded;
}

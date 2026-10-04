import type { ImportDialog } from './import-dialog';

let loaded: typeof ImportDialog | null = null;

/** Loads the Import dialog chunk (044). The parsers are not in it: the import worker loads them. */
export function preloadImportDialog(): Promise<{ default: typeof ImportDialog }> {
  return import('./import-dialog').then((module) => {
    loaded = module.ImportDialog;
    return { default: module.ImportDialog };
  });
}

/** The dialog component once its chunk has loaded, else `null`. */
export function loadedImportDialog(): typeof ImportDialog | null {
  return loaded;
}

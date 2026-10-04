import { createElement, lazy, Suspense } from 'react';

import { loadedImportDialog, preloadImportDialog } from './import-dialog-loader';

const LazyImportDialog = lazy(preloadImportDialog);

/** Renders the Import dialog; mount it only while `ui.importDialog.open` (as the Export dialog). */
export function ImportDialogMount() {
  const loaded = loadedImportDialog();
  if (loaded !== null) return createElement(loaded);
  return (
    <Suspense fallback={null}>
      <LazyImportDialog />
    </Suspense>
  );
}

import { createElement, lazy, Suspense } from 'react';

import { loadedExportDialog, preloadExportDialog } from './export-dialog-loader';

const LazyExportDialog = lazy(preloadExportDialog);

/**
 * Renders the Export dialog; mount it only while `ui.exportDialog.open`. Once the chunk has
 * loaded (prefetched when idle) the dialog renders directly: going through `lazy` + `Suspense`
 * again would suspend for a tick, and React throttles the reveal of suspended content
 * (~300 ms), which would miss the 300 ms open target (012 SC-003).
 */
export function ExportDialogMount() {
  const loaded = loadedExportDialog();
  if (loaded !== null) return createElement(loaded);
  return (
    <Suspense fallback={null}>
      <LazyExportDialog />
    </Suspense>
  );
}

import type { SododeckFile } from '@sododeck/schema';
import { useEffect } from 'react';
import { supportsIdleCallback } from '../../lib/features';
import { useUiStore } from '../../state/ui-store';
import { preloadExportDialog } from '../export/export-dialog-loader';
import { ExportDialogMount } from '../export/export-dialog-mount';
import { ImportDialogMount } from '../import/import-dialog-mount';
import { MermaidImportDialog } from '../import/mermaid-import-dialog';
import { PANEL_COLLAPSED } from '../panel-height';
import { CodeDrawer } from './code-drawer';
import { DeckIsland } from './deck-island';
import { DetailDrawer } from './detail-drawer';
import { Flyouts } from './flyouts';
import { HistoryIsland } from './history-island';
import { JsonOverlay } from './json-overlay';
import { Rail } from './rail';
import { EDGE, zoomIslandBottom } from './shell-geometry';
import { CanvasMenu } from '../quick-edit/canvas-menu';
import { SelectionToolbar } from '../quick-edit/selection-toolbar';
import { ShortcutHelpDialog } from './shortcut-help-dialog';
import { ShowUiPill } from './show-ui-pill';
import { ToolsIsland } from './tools-island';
import { useCompactShell } from './use-compact-shell';
import { useDrawerWidths } from './use-drawer-widths';
import { useShellShortcuts } from './use-shell-shortcuts';
import { ZoomIsland } from './zoom-island';

/**
 * Everything that floats over the canvas (018, ADR 0014): the deck and tools islands, the rail
 * with Undo / Redo under it, the flyout, the details drawer, the code drawer (DBML / SQL, 054), the JSON overlay and the
 * zoom island. Hide UI leaves only the "Show UI" pill; the state of each part is kept.
 */
export function ShellChrome({
  deck,
  onOpenRules,
}: {
  deck: SododeckFile;
  onOpenRules?: () => void;
}) {
  const hideUi = useUiStore((s) => s.hideUi);
  const jsonShown = useUiStore((s) => s.jsonShown);
  const jsonHeight = useUiStore((s) => (s.jsonPanel.open ? s.jsonPanel.height : PANEL_COLLAPSED));
  const compact = useCompactShell();
  const exportOpen = useUiStore((s) => s.exportDialog.open);
  const importOpen = useUiStore((s) => s.importDialog.open);
  const mermaidOpen = useUiStore((s) => s.mermaidDialog.open);
  useShellShortcuts();
  useEffect(() => {
    const preload = () => {
      void preloadExportDialog();
    };
    // The dialog chunk (renderer, fonts) loads while the editor is idle, so Export opens at once.
    if (supportsIdleCallback()) {
      const id = window.requestIdleCallback(preload);
      return () => {
        window.cancelIdleCallback(id);
      };
    }
    const id = window.setTimeout(preload, 2000);
    return () => {
      window.clearTimeout(id);
    };
  }, []);
  // Leaving the canvas (the rule editor) closes a temporary flyout; a pinned one comes back.
  useEffect(
    () => () => {
      useUiStore.getState().dismissFlyout();
    },
    [],
  );

  // The open drawers as one stack on the right edge: the zoom island and the JSON overlay stop
  // at its left edge.
  const { stack: drawerWidth } = useDrawerWidths();

  return (
    <>
      {hideUi ? (
        <ShowUiPill />
      ) : (
        <>
          <DeckIsland deck={deck} compact={compact} />
          <ToolsIsland />
          <div className="pointer-events-none absolute top-1/2 left-3 flex -translate-y-1/2 flex-col gap-2">
            <Rail />
            <HistoryIsland />
          </div>
          <Flyouts deck={deck} />
          <JsonOverlay drawerWidth={drawerWidth} />
          <DetailDrawer
            deck={deck}
            compact={compact}
            {...(onOpenRules === undefined ? {} : { onOpenRules })}
          />
          <CodeDrawer />
          <SelectionToolbar />
          <ZoomIsland
            bottom={zoomIslandBottom(jsonShown, jsonHeight)}
            right={drawerWidth === null ? EDGE : EDGE + drawerWidth + EDGE}
          />
        </>
      )}
      {/* Not part of the chrome Hide UI removes: right-click menus keep working (019). */}
      <CanvasMenu />
      <ShortcutHelpDialog />
      {exportOpen && <ExportDialogMount />}
      {importOpen && <ImportDialogMount />}
      {mermaidOpen && <MermaidImportDialog />}
    </>
  );
}

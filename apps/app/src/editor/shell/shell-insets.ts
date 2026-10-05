import { PANEL_COLLAPSED } from '../panel-height';
import { useUiStore } from '../../state/ui-store';
import {
  chromeInsets,
  clampCodeDrawerWidth,
  clampDrawerWidth,
  drawerStackWidth,
  type Insets,
} from './shell-geometry';
import { isCompactNow } from './use-compact-shell';

/** The stack of open drawers, as `useDrawerWidths` draws it, for code outside React. */
function currentDrawerStack(ui: ReturnType<typeof useUiStore.getState>): number | null {
  const viewport = typeof window === 'undefined' ? Number.POSITIVE_INFINITY : window.innerWidth;
  const compact = isCompactNow();
  const details = ui.drawer.open ? clampDrawerWidth(ui.drawer.width, viewport, compact) : null;
  const { codeDrawer } = ui.jsonPanel;
  const code = codeDrawer.open
    ? clampCodeDrawerWidth(codeDrawer.width, viewport, details, compact)
    : null;
  return drawerStackWidth(details, code);
}

/** The chrome currently over the canvas (018), for fits that must land in the free area. */
export function currentInsets(playerShown: boolean): Insets {
  const ui = useUiStore.getState();
  const shown = !ui.hideUi;
  return chromeInsets({
    flyoutOpen: shown && ui.flyout !== null,
    drawerWidth: shown ? currentDrawerStack(ui) : null,
    jsonHeight:
      shown && ui.jsonShown ? (ui.jsonPanel.open ? ui.jsonPanel.height : PANEL_COLLAPSED) : null,
    playerShown: shown && playerShown,
  });
}

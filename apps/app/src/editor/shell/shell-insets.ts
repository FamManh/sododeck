import { PANEL_COLLAPSED } from '../panel-height';
import { useUiStore } from '../../state/ui-store';
import { chromeInsets, type Insets } from './shell-geometry';

/** The chrome currently over the canvas (018), for fits that must land in the free area. */
export function currentInsets(playerShown: boolean): Insets {
  const ui = useUiStore.getState();
  const shown = !ui.hideUi;
  return chromeInsets({
    flyoutOpen: shown && ui.flyout !== null,
    drawerWidth: shown && ui.drawer.open ? ui.drawer.width : null,
    jsonHeight:
      shown && ui.jsonShown ? (ui.jsonPanel.open ? ui.jsonPanel.height : PANEL_COLLAPSED) : null,
    playerShown: shown && playerShown,
  });
}

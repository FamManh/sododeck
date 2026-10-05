import { useUiStore } from '../../state/ui-store';
import { clampCodeDrawerWidth, clampDrawerWidth, drawerStackWidth } from './shell-geometry';
import { useCompactShell } from './use-compact-shell';

export interface DrawerWidths {
  /** The details drawer, `null` when closed. */
  details: number | null;
  /** The code drawer, `null` when closed. */
  code: number | null;
  /** The widest the code drawer can get now (the grip's maximum). */
  codeMax: number;
  /** Both together with the gap between them (`null` when none is open). */
  stack: number | null;
}

/**
 * The widths of the open drawers as drawn (054): each clamped to the window, the code drawer
 * leaving the canvas a strip next to the details drawer. Everything that must clear the drawers
 * (zoom island, JSON overlay, minimap, the step player) takes `stack`.
 */
export function useDrawerWidths(): DrawerWidths {
  const compact = useCompactShell();
  const detailsOpen = useUiStore((s) => s.drawer.open);
  const detailsWidth = useUiStore((s) => s.drawer.width);
  const codeOpen = useUiStore((s) => s.jsonPanel.codeDrawer.open);
  const codeWidth = useUiStore((s) => s.jsonPanel.codeDrawer.width);
  const viewport = typeof window === 'undefined' ? Number.POSITIVE_INFINITY : window.innerWidth;
  const details = detailsOpen ? clampDrawerWidth(detailsWidth, viewport, compact) : null;
  const code = codeOpen ? clampCodeDrawerWidth(codeWidth, viewport, details, compact) : null;
  const codeMax = clampCodeDrawerWidth(Number.MAX_SAFE_INTEGER, viewport, details, compact);
  return { details, code, codeMax, stack: drawerStackWidth(details, code) };
}

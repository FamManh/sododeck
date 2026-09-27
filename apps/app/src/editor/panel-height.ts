/** JSON panel height limits in px (004 research R7, contracts/json-panel-ui.md). */

/** 40 px header plus 3 lines of code at 19 px. */
export const PANEL_MIN = 96;
/** The canvas always keeps at least this much of the main area. */
export const CANVAS_MIN = 200;
/** Height of the collapsed bar. */
export const PANEL_COLLAPSED = 36;

/** Largest panel height that leaves the canvas `CANVAS_MIN`, never below `PANEL_MIN`. */
export function maxPanelHeight(available: number): number {
  return Math.max(PANEL_MIN, available - CANVAS_MIN);
}

/** Keeps a requested height between `PANEL_MIN` and `available − CANVAS_MIN`. */
export function clampPanelHeight(requested: number, available: number): number {
  if (!Number.isFinite(requested)) return PANEL_MIN;
  return Math.min(Math.max(requested, PANEL_MIN), maxPanelHeight(available));
}

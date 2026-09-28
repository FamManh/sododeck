import type { Id, View } from '@sododeck/schema';

/** Width assumed for a tab not measured yet, and room kept for "More views" and "+". */
export const TAB_ESTIMATE = 96;
const CONTROLS_WIDTH = 80;

/**
 * Which views get a tab when only `available` px fit (011 edge case "Many views"): the rest go
 * into "More views", and the current view always keeps a tab. `null` = no measurement: all fit.
 */
export function visibleTabs(
  views: readonly View[],
  currentId: Id,
  available: number | null,
  widthOf: (id: Id) => number,
): { shown: View[]; overflow: View[] } {
  if (available === null) return { shown: [...views], overflow: [] };
  const total = views.reduce((sum, v) => sum + widthOf(v.id), 0);
  if (total <= available) return { shown: [...views], overflow: [] };
  const room = available - CONTROLS_WIDTH;
  const shown: View[] = [];
  let used = 0;
  for (const view of views) {
    if (shown.length > 0 && used + widthOf(view.id) > room) break;
    shown.push(view);
    used += widthOf(view.id);
  }
  if (!shown.some((v) => v.id === currentId)) {
    const current = views.find((v) => v.id === currentId);
    if (current !== undefined) {
      if (shown.length > 1) shown.pop();
      shown.push(current);
    }
  }
  const shownIds = new Set(shown.map((v) => v.id));
  return { shown, overflow: views.filter((v) => !shownIds.has(v.id)) };
}

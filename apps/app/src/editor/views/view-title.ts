/** How views are named in the UI (011 FR-002, FR-004). */
import { resolveViews } from '@sododeck/model';
import type { Id, View } from '@sododeck/schema';

/** The breadcrumb's view crumb and the switch announcement: "<title> view". */
export function viewCrumbTitle(view: Pick<View, 'title'>): string {
  return `${view.title} view`;
}

/**
 * A view tab's accessible name. The built-in Overview and Flows read "<title> view"; any other view
 * "<title>, <type> view", which tells duplicate titles apart (054: "Overview, system view" read
 * badly now that the preset titles say what the views are).
 */
export function viewTabName(view: Pick<View, 'id' | 'title' | 'type'>): string {
  const builtIn =
    (view.id === 'system' && view.type === 'system') ||
    (view.id === 'feature' && view.type === 'feature');
  return builtIn ? `${view.title} view` : `${view.title}, ${view.type} view`;
}

/** The crumb of the view `currentViewId` among the deck's views (the first when not found). */
export function currentViewCrumb(views: readonly View[] | undefined, currentViewId: Id | null) {
  const resolved = resolveViews({ views: views ?? [] });
  const view = resolved.find((v) => v.id === currentViewId) ?? resolved[0];
  return view === undefined ? 'Overview view' : viewCrumbTitle(view);
}

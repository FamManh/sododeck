/** How views are named in the UI (011 FR-002, FR-004). */
import { resolveViews } from '@sododeck/model';
import type { Id, View } from '@sododeck/schema';

/** The breadcrumb's view crumb and the switch announcement: "<title> view". */
export function viewCrumbTitle(view: Pick<View, 'title'>): string {
  return `${view.title} view`;
}

/** A view tab's accessible name: "<title>, <type> view" (tells duplicate titles apart). */
export function viewTabName(view: Pick<View, 'title' | 'type'>): string {
  return `${view.title}, ${view.type} view`;
}

/** The crumb of the view `currentViewId` among the deck's views (the first when not found). */
export function currentViewCrumb(views: readonly View[] | undefined, currentViewId: Id | null) {
  const resolved = resolveViews({ views: views ?? [] });
  const view = resolved.find((v) => v.id === currentViewId) ?? resolved[0];
  return view === undefined ? 'System view' : viewCrumbTitle(view);
}

/**
 * Saved views as data (research R3, ADR 0012). Presets are plain `View` objects with fixed ids,
 * shown while a deck has no stored views and written on its first view change. Their type only
 * picks these defaults and the tab tooltip (FR-002a): no code branches on `view.type`.
 */
import type { Id, SododeckFile, View } from '@sododeck/schema';

/** System, Feature and Infra, in switcher order. The first one is the base view. */
export const VIEW_PRESETS: readonly View[] = Object.freeze([
  Object.freeze({ id: 'system', type: 'system', title: 'System', subtitleField: 'tech' }),
  Object.freeze({ id: 'feature', type: 'feature', title: 'Feature', subtitleField: 'flows' }),
  Object.freeze({
    id: 'infra',
    type: 'infra',
    title: 'Infra',
    subtitleField: 'host',
    dimKinds: Object.freeze(['client']) as View['dimKinds'],
  }),
] satisfies View[]);

export const PRESET_VIEW_IDS: ReadonlySet<Id> = new Set(VIEW_PRESETS.map((v) => v.id));

/** Settings of a view added with "+" (FR-010). */
export const CUSTOM_VIEW_DEFAULTS = {
  type: 'custom',
  subtitleField: 'tech',
} as const satisfies Partial<View>;

/** The deck's stored views, else the presets. Keeps the array identity of either. */
export function resolveViews(file: Pick<SododeckFile, 'views'>): readonly View[] {
  return file.views.length > 0 ? file.views : VIEW_PRESETS;
}

/** The base view: the first one, which uses and edits the nodes' own positions (FR-020). */
export function baseViewId(views: readonly View[]): Id {
  return views[0]?.id ?? '';
}

/** "Custom <n>" with the lowest n no view uses as its exact title (FR-040). */
export function nextCustomTitle(views: readonly View[]): string {
  const titles = new Set(views.map((v) => v.title));
  let n = 1;
  while (titles.has(`Custom ${String(n)}`)) n++;
  return `Custom ${String(n)}`;
}

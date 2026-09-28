import type { Id } from '@sododeck/schema';
import { useEffect, useRef } from 'react';

import { useUiStore } from '../../state/ui-store';
import { useViews } from './use-current-view';
import { viewCrumbTitle } from './view-title';

/**
 * Keeps the current view pointing at an existing view (011 edge cases): when it disappears (a
 * delete here, undo, or another tab), the view on its left becomes current (the first when none)
 * and the switch is announced. Opening a deck or storing the presets keeps the current view,
 * since preset ids are fixed.
 */
export function useCurrentViewSync(): void {
  const views = useViews();
  const previous = useRef<readonly Id[]>(views.map((v) => v.id));

  useEffect(() => {
    const before = previous.current;
    previous.current = views.map((v) => v.id);
    const ui = useUiStore.getState();
    const currentId = ui.currentViewId;
    if (currentId === null || views.some((v) => v.id === currentId)) return;
    const index = before.indexOf(currentId);
    const left = before
      .slice(0, Math.max(0, index))
      .reverse()
      .map((id) => views.find((v) => v.id === id))
      .find((v) => v !== undefined);
    const next = left ?? views[0];
    if (next === undefined) return;
    ui.switchView(next.id);
    ui.announce(viewCrumbTitle(next));
  }, [views]);
}

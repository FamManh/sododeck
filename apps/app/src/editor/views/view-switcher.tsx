import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import type { Id } from '@sododeck/schema';
import { useRef, useState, type KeyboardEvent } from 'react';

import { selectView, useViewState } from './use-current-view';
import { viewTabName } from './view-title';

/**
 * The view switcher (design 02/20–22, FR-002): a segmented tab list in the top bar's centre, the
 * current view raised. Roving tabindex: ←/→ move focus, Home/End jump, Enter/Space select. The
 * canvas fits the new view itself (it watches `currentViewId`).
 */
export function ViewSwitcher() {
  const { views, view: current } = useViewState();
  const [focusedId, setFocusedId] = useState<Id | null>(null);
  const tabRefs = useRef(new Map<Id, HTMLButtonElement>());
  const stopId = views.some((v) => v.id === focusedId) ? focusedId : current.id;

  const focusTab = (id: Id | undefined) => {
    if (id === undefined) return;
    setFocusedId(id);
    tabRefs.current.get(id)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = views.length - 1;
    const target =
      event.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : event.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (target !== null) {
      event.preventDefault();
      focusTab(views[target]?.id);
    }
  };

  return (
    <div className="flex min-w-0 items-center gap-1 rounded-input bg-surface-2 p-0.5">
      <div role="tablist" aria-label="Views" className="flex min-w-0 items-center gap-0.5">
        {views.map((view, index) => {
          const selected = view.id === current.id;
          return (
            <button
              key={view.id}
              ref={(element) => {
                if (element) tabRefs.current.set(view.id, element);
                else tabRefs.current.delete(view.id);
              }}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={viewTabName(view)}
              title={`${view.title} · ${view.type} view`}
              tabIndex={view.id === stopId ? 0 : -1}
              onFocus={() => {
                setFocusedId(view.id);
              }}
              onClick={() => {
                if (!selected) selectView(view);
              }}
              onKeyDown={(event) => {
                onKeyDown(event, index);
              }}
              className={cn(
                'h-8 max-w-40 shrink-0 cursor-pointer truncate rounded-segment px-3 text-body-sm text-ink-secondary transition-colors hover:text-ink',
                selected && 'bg-surface font-medium text-ink shadow-rest',
                focusRing,
              )}
            >
              {view.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}

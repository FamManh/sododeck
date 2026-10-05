import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import type { KeyboardEvent, ReactNode } from 'react';

import { useUiStore } from '../../state/ui-store';

export interface DrawerTab<T extends string> {
  id: T;
  label: string;
}

/**
 * A drawer's tab bar and its panel (052 R2; shared by the table drawer and deck settings): an
 * ARIA tablist with roving focus (← → Home End move and select), the segmented look of design
 * frame 164, and a screen-reader announcement on change. `idPrefix` keeps the tab and panel ids
 * unique per drawer. No dependency: the app already hand-rolls its other tablists.
 */
export function DrawerTabs<T extends string>({
  tabs,
  tab,
  onChange,
  label,
  idPrefix,
  children,
}: {
  tabs: readonly DrawerTab<T>[];
  tab: T;
  onChange: (tab: T) => void;
  /** The tablist's accessible name, e.g. "Table sections". */
  label: string;
  idPrefix: string;
  children: ReactNode;
}) {
  const announce = useUiStore((s) => s.announce);
  const tabId = (id: T) => `${idPrefix}-tab-${id}`;
  const panelId = `${idPrefix}-tabpanel`;
  const select = (id: T, focus: boolean) => {
    onChange(id);
    const name = tabs.find((t) => t.id === id)?.label ?? id;
    announce(`${name} tab`);
    if (focus) document.getElementById(tabId(id))?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = tabs.length - 1;
    const index = tabs.findIndex((t) => t.id === tab);
    const target =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (target === null) return;
    const next = tabs[target];
    if (next === undefined) return;
    event.preventDefault();
    select(next.id, true);
  };
  const current = tabs.find((t) => t.id === tab);
  return (
    <>
      <div
        role="tablist"
        aria-label={label}
        className="mx-4 mt-3 flex gap-0.5 rounded-button bg-surface-2 p-0.5"
      >
        {tabs.map(({ id, label: name }) => {
          const selected = id === tab;
          return (
            <button
              key={id}
              id={tabId(id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                select(id, false);
              }}
              onKeyDown={onKeyDown}
              className={cn(
                'flex-1 rounded-button px-2.5 py-1 text-body-sm transition-colors',
                selected
                  ? 'bg-surface font-medium text-ink shadow-rest'
                  : 'text-ink-secondary hover:text-ink',
                focusRing,
              )}
            >
              {name}
            </button>
          );
        })}
      </div>
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId(tab)}
        aria-label={current?.label}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {children}
      </div>
    </>
  );
}

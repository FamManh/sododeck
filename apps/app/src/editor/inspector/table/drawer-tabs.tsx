import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import type { KeyboardEvent, ReactNode } from 'react';

import { useUiStore, type TableTab } from '../../../state/ui-store';

const TABLE_TABS: readonly { id: TableTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'columns', label: 'Columns' },
  { id: 'indexes', label: 'Indexes' },
  { id: 'checks', label: 'Checks' },
];

const tabId = (id: TableTab) => `table-tab-${id}`;

/**
 * The table drawer's tab bar and its panel (052 R2): an ARIA tablist with roving focus
 * (← → Home End move and select), the segmented look of design frame 164. No dependency: the
 * app already hand-rolls its other tablists.
 */
export function DrawerTabs({
  tab,
  onChange,
  children,
}: {
  tab: TableTab;
  onChange: (tab: TableTab) => void;
  children: ReactNode;
}) {
  const announce = useUiStore((s) => s.announce);
  const select = (id: TableTab, focus: boolean) => {
    onChange(id);
    const label = TABLE_TABS.find((t) => t.id === id)?.label ?? id;
    announce(`${label} tab`);
    if (focus) document.getElementById(tabId(id))?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = TABLE_TABS.length - 1;
    const index = TABLE_TABS.findIndex((t) => t.id === tab);
    const target =
      event.key === 'ArrowRight'
        ? (index + 1) % TABLE_TABS.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + TABLE_TABS.length) % TABLE_TABS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (target === null) return;
    const next = TABLE_TABS[target];
    if (next === undefined) return;
    event.preventDefault();
    select(next.id, true);
  };
  const current = TABLE_TABS.find((t) => t.id === tab);
  return (
    <>
      <div
        role="tablist"
        aria-label="Table sections"
        className="mx-4 mt-3 flex gap-0.5 rounded-button bg-surface-2 p-0.5"
      >
        {TABLE_TABS.map(({ id, label }) => {
          const selected = id === tab;
          return (
            <button
              key={id}
              id={tabId(id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="table-tabpanel"
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
              {label}
            </button>
          );
        })}
      </div>
      <div
        id="table-tabpanel"
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

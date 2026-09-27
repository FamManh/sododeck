import { Panel, PanelContent, PanelSection } from '@sododeck/ui/components/panel';
import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import type { SododeckFile } from '@sododeck/schema';
import { useId, useRef } from 'react';

import { useUiStore, type LeftTab } from '../state/ui-store';
import { OutlineTree } from './outline-tree';
import { Palette } from './palette';

const TABS: readonly { id: LeftTab; label: string }[] = [
  { id: 'outline', label: 'Outline' },
  { id: 'palette', label: 'Palette' },
];

/** Left panel: Outline and Palette tabs (design 02/14). */
export function LeftSidebar({ deck }: { deck: SododeckFile }) {
  const leftTab = useUiStore((s) => s.leftTab);
  const setLeftTab = useUiStore((s) => s.setLeftTab);
  const baseId = useId();
  const tabRefs = useRef<Partial<Record<LeftTab, HTMLButtonElement | null>>>({});

  return (
    <Panel aria-label="Outline">
      <div
        role="tablist"
        aria-label="Left panel"
        className="m-3 mb-0 grid shrink-0 grid-cols-2 gap-0.5 rounded-button bg-surface-2 p-0.5"
      >
        {TABS.map((tab, index) => {
          const selected = tab.id === leftTab;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                setLeftTab(tab.id);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                event.preventDefault();
                const next = TABS[(index + 1) % TABS.length];
                if (!next) return;
                setLeftTab(next.id);
                tabRefs.current[next.id]?.focus();
              }}
              className={cn(
                'h-8 cursor-pointer rounded-segment text-body-sm text-ink-secondary transition-colors hover:text-ink',
                selected && 'bg-surface font-medium text-ink shadow-rest',
                focusRing,
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <PanelContent
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${leftTab}`}
        className="px-1"
      >
        {leftTab === 'outline' ? (
          <PanelSection label={`Components · ${String(deck.nodes.length)}`}>
            <OutlineTree deck={deck} />
          </PanelSection>
        ) : (
          <PanelSection>
            <Palette />
          </PanelSection>
        )}
        <PanelSection label="Features">
          <p className="text-caption text-ink-muted">Flows and features arrive in Milestone 2.</p>
        </PanelSection>
      </PanelContent>
    </Panel>
  );
}

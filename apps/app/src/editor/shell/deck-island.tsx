import type { SododeckFile } from '@sododeck/schema';

import { isFlowMode, useUiStore } from '../../state/ui-store';
import { DeckName } from '../deck-name';
import { DrillCrumbs } from '../drill-crumbs';
import { FlowModeChip } from '../flows/flow-mode-chip';
import { SessionChip } from '../flows/session-chip';
import { SaveStatus } from '../save-status';
import { useTidyBlock, useTidyLayout } from '../tidy-layout';
import { TidyProgress } from '../views/tidy-layout-item';
import { ViewSwitcher } from '../views/view-switcher';
import { DeckMenu } from './deck-menu';
import { Island, IslandDivider } from './island';

/**
 * The deck island, top-left (018 FR-006–FR-010, design 86): ≡ menu, deck name, save status as an
 * icon, then the views control. A recording session replaces the views with its chip (006); flow
 * mode adds the "Flow · <name>" chip and drilling in the breadcrumb chip (§g-46).
 */
export function DeckIsland({ deck, compact = false }: { deck: SododeckFile; compact?: boolean }) {
  const inSession = useUiStore((s) => s.flowSession !== null);
  const flowMode = useUiStore(isFlowMode);
  const drilled = useUiStore((s) => s.drill.length > 0);
  // The run lives here, not in the menu, which unmounts when it closes (011's slow timer).
  const { run, cancel } = useTidyLayout();
  const block = useTidyBlock();
  const running = useUiStore((s) => s.layoutRun.status !== 'idle');
  const tidy = {
    block,
    running,
    run: () => {
      void run();
    },
  };

  return (
    <Island region="deck" label="Deck" className="top-3 left-3 max-w-[calc(100vw-24px-236px)]">
      <DeckMenu />
      <DeckName name={deck.name ?? 'Untitled deck'} className="max-w-56" />
      <SaveStatus variant="icon" />
      <IslandDivider />
      {inSession ? (
        <SessionChip />
      ) : (
        <div className="flex min-w-0 shrink items-center gap-1">
          <ViewSwitcher compact={compact} tidy={tidy} />
          <TidyProgress onCancel={cancel} />
        </div>
      )}
      {flowMode && !inSession && <FlowModeChip deck={deck} />}
      {drilled && (
        <nav
          aria-label="Breadcrumb"
          className="flex h-8 min-w-0 items-center gap-1 rounded-full bg-surface-2 px-2 text-body-sm text-ink-muted"
        >
          <DrillCrumbs deck={deck} />
        </nav>
      )}
    </Island>
  );
}

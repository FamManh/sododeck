import type { SododeckFile } from '@sododeck/schema';
import { PanelSection } from '@sododeck/ui/components/panel';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { Button } from '@sododeck/ui/components/button';
import { ArrowRight, FileCode2, Layers } from 'lucide-react';
import { useRef, useState } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { DeckInspectorStorage } from '../deck-inspector-storage';
import { FieldEdit } from '../field-edit';
import { MarkdownField } from '../fields/markdown-field';
import { oneStep } from '../fields/one-step';
import { ProblemsPanel } from '../problems/problems-panel';
import { useGoToProblem } from '../problems/use-go-to-problem';
import { useRuleNav } from '../rules/rule-nav';
import { TagsField } from '../fields/tags-field';
import { CanvasBackgroundSection } from './canvas-background-section';
import { deckStats } from './derive';
import { InspectorFrame } from './inspector-frame';
import { DatabaseSection } from './database/database-section';
import { DrawerTabs, type DrawerTab } from './drawer-tabs';

const noop = () => undefined;

export type DeckTab = 'general' | 'database';

const DECK_TABS: readonly DrawerTab<DeckTab>[] = [
  { id: 'general', label: 'General' },
  { id: 'database', label: 'Database' },
];

/**
 * Deck inspector, shown when nothing is selected (FR-012, design 10). The General tab holds the
 * deck's problems first (015, design 60), name (required), markdown description, tags, counts
 * with a way into the rule editor, the canvas background (ADR 0044) and 005's storage; the
 * Database tab starts with "Import SQL or DBML…" and, in a deck with a table or the Database pack
 * on, holds the dialect and the tables' display settings (041, 052). Both tabs always show. The
 * tab is UI-only state that starts on Database each time the settings open, so DBML can be pasted
 * right away (founder feedback 2026-10-06); `initialTab` asks for another.
 */
export function DeckInspector({
  deck,
  onOpenRules,
  initialTab = 'database',
}: {
  deck: SododeckFile;
  /** The tab to open on; Database unless a caller asks for General. */
  initialTab?: DeckTab;
  /** Opens the rule editor; undefined outside a routed editor. */
  onOpenRules?: () => void;
}) {
  const editor = useEditor();
  const ruleNav = useRuleNav();
  const goTo = useGoToProblem({
    screen: 'canvas',
    openRules: (ruleId) => {
      ruleNav?.openRules(ruleId);
    },
    navigateToCanvas: noop,
  });
  const [tab, setTab] = useState<DeckTab>(initialTab);
  const importButton = useRef<HTMLButtonElement>(null);
  const stats = deckStats(deck);
  const name = deck.name ?? 'Untitled deck';
  const general = (
    <>
      <ProblemsPanel onActivate={goTo} />
      <PanelSection>
        <FieldEdit
          label="Name"
          value={deck.name ?? ''}
          placeholder="Untitled deck"
          onCommit={(value) => {
            editor.updateMeta({ name: value });
          }}
        />
      </PanelSection>
      <PanelSection>
        <MarkdownField
          modeKey="deck"
          value={deck.description ?? ''}
          placeholder="What is this deck about? Markdown supported."
          onCommit={(description) => {
            editor.updateMeta({ description: description === '' ? null : description });
          }}
        />
      </PanelSection>
      <PanelSection>
        <TagsField
          deck={deck}
          value={deck.tags}
          onCommit={(tags) => {
            oneStep(editor, () => {
              editor.updateMeta({ tags });
            });
          }}
        />
      </PanelSection>
      <PanelSection label="Summary">
        <ul aria-label="Deck summary" className="grid grid-cols-2 gap-2">
          {(
            [
              ['Components', stats.components],
              ['Connections', stats.connections],
              ['Flows', stats.flows],
            ] as const
          ).map(([label, count]) => (
            <li key={label} className="flex flex-col rounded-card bg-surface-2 px-3 py-2">
              <span className="text-title-md">{count}</span>
              <span className="text-caption text-ink-secondary">{label}</span>
            </li>
          ))}
          <li>
            <button
              type="button"
              aria-label={`Rules ${String(stats.rules)}`}
              disabled={onOpenRules === undefined}
              onClick={onOpenRules}
              className={cn(
                'flex w-full cursor-pointer items-center rounded-card bg-surface-2 px-3 py-2 text-left hover:bg-surface-3 disabled:cursor-default disabled:hover:bg-surface-2',
                focusRing,
              )}
            >
              <span className="flex flex-1 flex-col">
                <span className="text-title-md">{stats.rules}</span>
                <span className="text-caption text-ink-secondary">Rules</span>
              </span>
              {onOpenRules !== undefined && (
                <ArrowRight aria-hidden className="size-4 text-ink-secondary" />
              )}
            </button>
          </li>
        </ul>
      </PanelSection>
      <CanvasBackgroundSection deck={deck} />
      <DeckInspectorStorage />
    </>
  );
  const database = (
    <>
      <PanelSection label="Import">
        <Button
          ref={importButton}
          onClick={() => {
            useUiStore.getState().openImport(importButton.current);
          }}
        >
          <FileCode2 />
          Import SQL or DBML…
        </Button>
        <p className="text-caption text-ink-secondary">
          Paste a schema to add its tables to this deck.
        </p>
      </PanelSection>
      <DatabaseSection deck={deck} />
    </>
  );
  return (
    <InspectorFrame
      icon={<Layers aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-5" />}
      heading={name}
      subtitle="Deck"
    >
      <DrawerTabs
        tabs={DECK_TABS}
        tab={tab}
        onChange={setTab}
        label="Deck settings sections"
        idPrefix="deck-settings"
      >
        {tab === 'database' ? database : general}
      </DrawerTabs>
    </InspectorFrame>
  );
}

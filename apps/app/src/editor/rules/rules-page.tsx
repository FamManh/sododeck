import { evaluateRule } from '@sododeck/model';
import { Button } from '@sododeck/ui/components/button';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { Plus, Table2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { DecisionTable } from './decision-table';
import { RuleChecks } from './rule-checks';
import { RuleHeader } from './rule-header';
import { RuleList } from './rule-list';
import { rulesPath } from './rules-path';
import { TestPanel } from './test-panel';
import { UsedIn } from './used-in';
import { useRuleSync } from './use-rule-sync';

const EMPTY_VALUES: Readonly<Record<string, string>> = {};

/**
 * The rule editor screen (008 US4–US6, designs 04, 28, 29) at `/deck/:deckId/rules/:ruleId?`:
 * DECISION TABLES on the left, the open rule's header and table in the centre, TEST INPUT,
 * USED IN and CHECKS on the right. Same document, undo history and UI store as the canvas.
 */
export function RulesPage() {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const { deckId, ruleId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const rule = ruleId === undefined ? undefined : deck.rules[ruleId];
  const [renameColumnId, setRenameColumnId] = useState<string | null>(null);
  useRuleSync(deckId, ruleId, rule !== undefined);

  // A rule opened without "Edit rule" starts with empty test values.
  useEffect(() => {
    if (ruleId === undefined) return;
    const ui = useUiStore.getState();
    if (ui.ruleTest?.ruleId !== ruleId) ui.setRuleTest({ ruleId, values: {}, from: null });
  }, [ruleId]);

  const values = useUiStore((s) =>
    s.ruleTest !== null && s.ruleTest.ruleId === ruleId ? s.ruleTest.values : EMPTY_VALUES,
  );
  const evaluation = useMemo(
    () => (rule === undefined ? null : evaluateRule(rule, values)),
    [rule, values],
  );
  const matched = useMemo(
    () => new Set(evaluation?.status === 'match' ? evaluation.rows : []),
    [evaluation],
  );

  const newRule = () => {
    const id = editor.addRule({ title: 'Untitled rule', hitPolicy: 'first' });
    void navigate(rulesPath(deckId, id), { state: { newRule: true } });
  };
  const isNew = (location.state as { newRule?: boolean } | null)?.newRule === true;

  return (
    <div className="grid min-h-0 grid-cols-[264px_minmax(0,1fr)_336px] gap-px bg-hairline">
      <RuleList deck={deck} deckId={deckId} ruleId={ruleId} onNew={newRule} />
      <main className="min-h-0 overflow-y-auto bg-canvas px-8 py-6">
        {rule !== undefined && ruleId !== undefined && evaluation !== null ? (
          <div className="flex flex-col gap-5">
            <RuleHeader
              key={`header-${ruleId}`}
              ruleId={ruleId}
              rule={rule}
              autoFocusName={isNew}
              onAddColumn={(side) => {
                const n = (side === 'inputs' ? rule.inputs : rule.outputs).length + 1;
                const label = `${side === 'inputs' ? 'Condition' : 'Action'} ${String(n)}`;
                setRenameColumnId(editor.addRuleColumn(ruleId, side, label));
              }}
            />
            <DecisionTable
              key={`table-${ruleId}`}
              ruleId={ruleId}
              rule={rule}
              matched={matched}
              renameColumnId={renameColumnId}
              onRenameDone={() => {
                setRenameColumnId(null);
              }}
            />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Table2 aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-8 text-ink-muted" />
            <p className="text-title-sm">
              {Object.keys(deck.rules).length === 0
                ? 'No decision tables yet'
                : 'Choose a decision table'}
            </p>
            <p className="max-w-80 text-body-sm text-ink-secondary">
              Decision tables hold business rules: conditions, actions and rows. Attach one to any
              flow step or component.
            </p>
            {Object.keys(deck.rules).length === 0 && (
              <Button variant="primary" onClick={newRule}>
                <Plus />
                Create a rule
              </Button>
            )}
          </div>
        )}
      </main>
      <aside
        aria-label="Rule details"
        className="min-h-0 divide-y divide-hairline overflow-y-auto bg-surface"
      >
        {rule !== undefined && ruleId !== undefined && evaluation !== null && (
          <>
            <TestPanel deck={deck} ruleId={ruleId} rule={rule} evaluation={evaluation} />
            <UsedIn deck={deck} deckId={deckId} ruleId={ruleId} />
            <RuleChecks rule={rule} />
          </>
        )}
      </aside>
    </div>
  );
}

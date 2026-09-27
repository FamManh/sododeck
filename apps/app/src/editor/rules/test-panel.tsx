import { analyzeFlow, type Evaluation } from '@sododeck/model';
import type { Id, Rule, SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { Input } from '@sododeck/ui/components/input';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { CircleAlert, CircleCheck, Save, TriangleAlert } from 'lucide-react';
import { useEffect, useId } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { oneStep } from '../fields/one-step';
import { actionsText, ambiguousText, NO_MATCH, resultLine, rowNumber } from './rule-text';

/** The step the editor was opened from, if it still uses the rule: "<flow> · Step n". */
function stepLabel(deck: SododeckFile, ruleId: Id, from: { flowId: Id; stepId: Id }) {
  const flow = deck.flows.find((f) => f.id === from.flowId);
  const step = flow?.steps.find((s) => s.id === from.stepId);
  if (flow === undefined || step?.rules?.includes(ruleId) !== true) return null;
  const number = analyzeFlow(flow, deck.edges).byStepId.get(step.id)?.number ?? '?';
  return `${flow.title} · Step ${number}`;
}

/**
 * TEST INPUT (FR-026, founder §g-6): one field per condition, the live result, and — when opened
 * from a step — "Save as step inputs". Test values are UI state only: never in the deck.
 */
export function TestPanel({
  deck,
  ruleId,
  rule,
  evaluation,
}: {
  deck: SododeckFile;
  ruleId: Id;
  rule: Rule;
  evaluation: Evaluation;
}) {
  const editor = useEditor();
  const test = useUiStore((s) => (s.ruleTest?.ruleId === ruleId ? s.ruleTest : null));
  const values = test?.values ?? {};
  const baseId = useId();
  const from = test?.from ?? null;
  const saveLabel = from === null ? null : stepLabel(deck, ruleId, from);
  const line = resultLine(rule, evaluation);

  // The result is announced politely once typing pauses (contract: debounced 500 ms).
  const valuesKey = JSON.stringify(values);
  useEffect(() => {
    if (valuesKey === '{}') return;
    const timer = setTimeout(() => {
      useUiStore.getState().announce(line);
    }, 500);
    return () => {
      clearTimeout(timer);
    };
  }, [valuesKey, line]);

  return (
    <section aria-labelledby={`${baseId}-title`} className="flex flex-col gap-3 px-4 py-4">
      <h2 id={`${baseId}-title`} className="text-micro text-ink-muted uppercase">
        Test input
      </h2>
      {rule.inputs.length === 0 ? (
        <p className="text-body-sm text-ink-secondary">This rule has no conditions yet.</p>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
          {rule.inputs.map((column) => (
            <label key={column.id} className="contents">
              <span className="truncate text-body-sm text-ink-secondary" title={column.label}>
                {column.label}
              </span>
              <Input
                aria-label={column.label}
                value={values[column.id] ?? ''}
                className="font-mono"
                onChange={(event) => {
                  const ui = useUiStore.getState();
                  if (ui.ruleTest?.ruleId !== ruleId) {
                    ui.setRuleTest({ ruleId, values: {}, from: null });
                  }
                  useUiStore.getState().setRuleTestValue(column.id, event.target.value);
                }}
              />
            </label>
          ))}
        </div>
      )}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'flex flex-col gap-1.5 rounded-card px-3 py-2.5 text-body-sm',
          evaluation.status === 'match' && 'bg-success-soft text-success-ink',
          evaluation.status !== 'match' && 'bg-clay-soft text-clay-ink',
        )}
      >
        <Result rule={rule} evaluation={evaluation} />
      </div>
      {from !== null && saveLabel !== null && (
        <Button
          className="self-start"
          onClick={() => {
            const allowed = new Set(rule.inputs.map((c) => c.id));
            const inputs = Object.fromEntries(
              Object.entries(values).filter(([id]) => allowed.has(id)),
            );
            oneStep(editor, () => {
              editor.setRuleInputs(from.flowId, from.stepId, ruleId, inputs);
            });
            useUiStore.getState().announce(`Saved as inputs of ${saveLabel}`);
          }}
        >
          <Save />
          Save as step inputs ({saveLabel})
        </Button>
      )}
    </section>
  );
}

function Result({ rule, evaluation }: { rule: Rule; evaluation: Evaluation }) {
  if (evaluation.status === 'none') {
    return (
      <p className="flex items-center gap-2">
        <CircleAlert aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4 shrink-0" />
        {NO_MATCH}
      </p>
    );
  }
  if (evaluation.status === 'ambiguous') {
    return (
      <p className="flex items-start gap-2">
        <TriangleAlert
          aria-hidden
          strokeWidth={ICON_STROKE_WIDTH}
          className="mt-0.5 size-4 shrink-0"
        />
        {ambiguousText(rule, evaluation.rows)}
      </p>
    );
  }
  const heading =
    evaluation.rows.length === 1
      ? `Matched Row ${String(rowNumber(rule, evaluation.rows[0] ?? ''))}`
      : `Matched ${String(evaluation.rows.length)} rows`;
  return (
    <>
      <p className="flex items-center gap-2 font-medium">
        <CircleCheck aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4 shrink-0" />
        {heading}
      </p>
      {evaluation.rows.map((rowId) => {
        const row = rule.rows.find((r) => r.id === rowId);
        if (row === undefined) return null;
        return (
          <dl
            key={rowId}
            aria-label={`Row ${String(rowNumber(rule, rowId))} actions`}
            title={actionsText(rule, rowId)}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5"
          >
            {evaluation.rows.length > 1 && (
              <dt className="col-span-2 text-caption">Row {rowNumber(rule, rowId)}</dt>
            )}
            {rule.outputs.map((column, i) => (
              <div key={column.id} className="contents">
                <dt className="truncate">{column.label}</dt>
                <dd className="text-right font-medium">{row.then[i] ?? ''}</dd>
              </div>
            ))}
          </dl>
        );
      })}
    </>
  );
}

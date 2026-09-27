import { evaluateRule } from '@sododeck/model';
import type { Id, Rule } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { Input } from '@sododeck/ui/components/input';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import {
  Check,
  CircleAlert,
  CircleCheck,
  Pencil,
  Table2,
  TriangleAlert,
  Unlink,
} from 'lucide-react';
import { useId, useMemo } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { useRuleNav } from '../rules/rule-nav';
import { conditionText, resultLine } from '../rules/rule-text';
import { useDetach } from './use-detach';

const EMPTY: Readonly<Record<Id, string>> = {};

/**
 * A rule attached to a step (FR-031, design 51): a compact table, the step's sample inputs
 * ("Evaluated with …", saved with the step as the user types) and the matched row. "Edit rule"
 * opens the rule editor with TEST INPUT pre-filled; Detach asks nothing (Undo toast).
 */
export function RuleCard({
  flowId,
  stepId,
  ruleId,
  rule,
  inputs = EMPTY,
}: {
  flowId: Id;
  stepId: Id;
  ruleId: Id;
  rule: Rule;
  inputs?: Readonly<Record<Id, string>>;
}) {
  const editor = useEditor();
  const nav = useRuleNav();
  const detach = useDetach();
  const titleId = useId();
  // Evaluated per rule object and inputs: an edit elsewhere in the deck re-evaluates nothing.
  const evaluation = useMemo(() => evaluateRule(rule, inputs), [rule, inputs]);
  const matched = new Set(evaluation.status === 'match' ? evaluation.rows : []);
  const evaluatedWith = rule.inputs.map((c) => `${c.label} ${inputs[c.id] ?? '—'}`).join(' · ');
  const Icon =
    evaluation.status === 'match'
      ? CircleCheck
      : evaluation.status === 'ambiguous'
        ? TriangleAlert
        : CircleAlert;

  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3"
    >
      <header className="flex items-center gap-2">
        <Table2
          aria-hidden
          strokeWidth={ICON_STROKE_WIDTH}
          className="size-4 shrink-0 text-amber-ink"
        />
        <h4
          id={titleId}
          className="min-w-0 flex-1 truncate text-body font-medium"
          title={rule.title}
        >
          {rule.title}
        </h4>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Edit rule"
          onClick={() => {
            useUiStore.getState().setRuleTest({ ruleId, values: inputs, from: { flowId, stepId } });
            nav?.openRules(ruleId);
          }}
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Detach ${rule.title}`}
          onClick={() => {
            detach(rule.title, () => {
              editor.detachRule({ kind: 'step', flowId, stepId }, ruleId);
            });
          }}
        >
          <Unlink />
        </Button>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-caption">
          <caption className="sr-only">{rule.title}</caption>
          <thead>
            <tr className="border-b border-hairline text-left text-ink-secondary">
              <th scope="col" className="w-6 py-1 font-normal">
                #
              </th>
              {[...rule.inputs, ...rule.outputs].map((c) => (
                <th key={c.id} scope="col" className="px-1 py-1 font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rule.rows.map((row, i) => {
              const isMatched = matched.has(row.id);
              return (
                <tr
                  key={row.id}
                  aria-selected={isMatched}
                  className={cn(
                    'border-b border-hairline last:border-b-0',
                    isMatched && 'bg-primary-soft text-primary-ink',
                  )}
                >
                  <th
                    scope="row"
                    className={cn('py-1 text-left font-normal', isMatched && 'font-semibold')}
                  >
                    <span className="flex items-center gap-0.5">
                      {isMatched && <Check aria-hidden strokeWidth={2} className="size-3" />}
                      {i + 1}
                    </span>
                  </th>
                  {row.when.map((cell, c) => (
                    <td key={`w${String(c)}`} className="px-1 py-1 font-mono">
                      {conditionText(cell)}
                    </td>
                  ))}
                  {row.then.map((cell, c) => (
                    <td key={`t${String(c)}`} className="px-1 py-1">
                      {cell}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rule.rows.length === 0 && (
          <p className="py-1 text-caption text-ink-secondary">No rows yet.</p>
        )}
      </div>
      {rule.inputs.length > 0 && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-caption text-ink-secondary">
            Evaluated with {evaluatedWith}
          </legend>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-1.5">
            {rule.inputs.map((column) => (
              <label key={column.id} className="contents">
                <span className="truncate text-caption text-ink-secondary">{column.label}</span>
                <Input
                  aria-label={column.label}
                  value={inputs[column.id] ?? ''}
                  className="h-7 font-mono text-body-sm"
                  onChange={(event) => {
                    editor.setRuleInputs(flowId, stepId, ruleId, {
                      ...inputs,
                      [column.id]: event.target.value,
                    });
                  }}
                />
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <p
        role="status"
        className={cn(
          'flex items-start gap-1.5 rounded-row px-2 py-1.5 text-body-sm',
          evaluation.status === 'match'
            ? 'bg-success-soft text-success-ink'
            : 'bg-clay-soft text-clay-ink',
        )}
      >
        <Icon aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="mt-0.5 size-4 shrink-0" />
        {resultLine(rule, evaluation)}
      </p>
    </article>
  );
}

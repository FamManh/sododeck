import { ruleUsage } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { Plus, Table2 } from 'lucide-react';
import { Link } from 'react-router';

import { ProblemGlyph } from '../problems/problem-glyph';
import { useProblems } from '../problems/use-problems';
import { rulesPath } from './rules-path';

const plural = (n: number, one: string) => `${String(n)} ${one}${n === 1 ? '' : 's'}`;

/** DECISION TABLES (FR-019, design 04): every rule with its size and usage, and New. */
export function RuleList({
  deck,
  deckId,
  ruleId,
  onNew,
}: {
  deck: SododeckFile;
  deckId: string | undefined;
  ruleId: string | undefined;
  onNew: () => void;
}) {
  const rules = Object.entries(deck.rules);
  const problems = useProblems();
  return (
    <nav aria-label="Decision tables" className="flex min-h-0 flex-col bg-surface">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-micro text-ink-muted uppercase">Decision tables</h2>
        <Button variant="chip" size="chip" aria-label="New rule" onClick={onNew}>
          <Plus />
          New
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        {rules.length === 0 ? (
          <p className="px-2 py-3 text-body-sm text-ink-secondary">No decision tables yet</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {rules.map(([id, rule]) => {
              const current = id === ruleId;
              const steps = ruleUsage(deck, id).steps.length;
              return (
                <li key={id}>
                  <Link
                    to={rulesPath(deckId, id)}
                    aria-current={current ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-card px-2 py-2 hover:bg-surface-2',
                      current && 'bg-primary-soft hover:bg-primary-soft',
                      focusRing,
                    )}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-row bg-amber-soft text-amber-ink">
                      <Table2 aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span
                        className={cn('truncate text-body', current && 'text-primary-ink')}
                        title={rule.title}
                      >
                        {rule.title}
                      </span>
                      <span className="truncate text-caption text-ink-secondary">
                        {plural(rule.rows.length, 'row')} · used in {plural(steps, 'step')}
                      </span>
                    </span>
                    <ProblemGlyph problems={problems?.byObject.get(id) ?? []} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="px-4 py-4 text-caption text-ink-secondary">
        Rules are shared across the deck. Attach one to any flow step; edits apply everywhere it is
        used.
      </p>
    </nav>
  );
}

import type { Problem, ProblemFix } from '@sododeck/model';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { ChevronRight, CircleCheck } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { oneStep } from '../fields/one-step';
import { PROBLEM_ICONS } from './problem-kinds';
import { PROBLEM_ROW_CAP } from './problems-dom';
import { useProblems } from './use-problems';

/**
 * The deck's problems (015 US1, design 60). Self-contained: it reads problems itself, so the
 * canvas-first shell (018) can move it from the deck inspector into a rail flyout unchanged.
 */
export function ProblemsPanel({ onActivate }: { onActivate?: (problem: Problem) => void }) {
  const problems = useProblems();
  const editor = useEditor();
  const announce = useUiStore((s) => s.announce);
  /** A row's one-click fix, one undo step. Only `remove-value` (032) exists so far. */
  const applyFix = (fix: ProblemFix) => {
    if (fix.kind !== 'remove-value') return;
    oneStep(editor, () => {
      editor.setValues([fix.nodeId], fix.fieldId, null);
    });
    announce('Value removed');
  };
  const [showAll, setShowAll] = useState<{ total: number } | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  if (problems === null) return null;

  const expanded = showAll !== null && showAll.total === problems.total;
  const rows = expanded ? problems.list : problems.list.slice(0, PROBLEM_ROW_CAP);
  const active = rows.find((p) => p.key === activeKey) ?? rows[0];

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const to =
      event.key === 'ArrowDown'
        ? index + 1
        : event.key === 'ArrowUp'
          ? index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? rows.length - 1
              : null;
    if (to === null) return;
    event.preventDefault();
    event.stopPropagation();
    const target = rows[Math.max(0, Math.min(rows.length - 1, to))];
    if (target === undefined) return;
    setActiveKey(target.key);
    event.currentTarget
      .closest('ul')
      ?.querySelector<HTMLElement>(`[data-problem-row="${CSS.escape(target.key)}"]`)
      ?.focus();
  };

  return (
    <section
      aria-labelledby="problems-heading"
      className="flex flex-col gap-2 border-b border-hairline px-4 py-3.5"
    >
      <h3 id="problems-heading" className="flex items-center text-micro text-ink-muted uppercase">
        <span className="flex-1">Problems</span>
        <span aria-label={`${String(problems.total)} total`}>{problems.total}</span>
      </h3>
      {problems.total === 0 ? (
        <p className="flex items-center gap-2 rounded-card bg-surface-2 px-3 py-2 text-body-sm text-ink">
          <CircleCheck
            aria-hidden
            strokeWidth={ICON_STROKE_WIDTH}
            className="size-4 text-success-ink"
          />
          No problems
        </p>
      ) : (
        <>
          <ul aria-label="Problems" className="flex flex-col gap-2">
            {rows.map((problem, index) => {
              const Icon = PROBLEM_ICONS[problem.kind];
              return (
                <li key={problem.key}>
                  <button
                    type="button"
                    data-problem-row={problem.key}
                    tabIndex={problem.key === active?.key ? 0 : -1}
                    onFocus={() => {
                      setActiveKey(problem.key);
                    }}
                    onClick={() => onActivate?.(problem)}
                    onKeyDown={(event) => {
                      onKeyDown(event, index);
                    }}
                    className={cn(
                      'flex w-full cursor-pointer items-start gap-3 rounded-card border border-transparent bg-surface-2 px-3 py-2.5 text-left hover:bg-surface-3',
                      'focus-visible:border-primary focus-visible:bg-primary-soft',
                      focusRing,
                    )}
                  >
                    <Icon
                      aria-hidden
                      strokeWidth={ICON_STROKE_WIDTH}
                      className="mt-0.5 size-4 shrink-0 text-ink-secondary"
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-title-sm text-ink">{problem.title}</span>
                      <span
                        id={`${problem.key}-detail`}
                        className="text-body-sm text-ink-secondary"
                      >
                        {problem.detail}
                      </span>
                    </span>
                    <ChevronRight
                      aria-hidden
                      strokeWidth={ICON_STROKE_WIDTH}
                      className="mt-0.5 size-4 shrink-0 text-ink-secondary"
                    />
                  </button>
                  {problem.fixes?.map((fix) => (
                    <button
                      key={fix.kind}
                      type="button"
                      aria-describedby={`${problem.key}-detail`}
                      onClick={() => {
                        applyFix(fix);
                      }}
                      className={cn(
                        'mt-1 ml-7 cursor-pointer rounded-button px-2 py-1 text-body-sm text-ink hover:bg-surface-2',
                        focusRing,
                      )}
                    >
                      {fix.label}
                    </button>
                  ))}
                </li>
              );
            })}
          </ul>
          {!expanded && problems.total > PROBLEM_ROW_CAP && (
            <button
              type="button"
              onClick={() => {
                setShowAll({ total: problems.total });
              }}
              className={cn(
                'self-start rounded-button px-2 py-1 text-body-sm text-ink hover:bg-surface-2',
                focusRing,
              )}
            >
              Show all {problems.total}
            </button>
          )}
          <p className="text-body-sm text-ink-secondary">
            Click a problem, or press ↵ on it, to select the object. The list updates as you edit.
          </p>
        </>
      )}
    </section>
  );
}

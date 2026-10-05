import { Button } from '@sododeck/ui/components/button';
import { useToast } from '@sododeck/ui/components/toast';
import { cn } from '@sododeck/ui/lib/utils';
import { Check, Copy, LoaderCircle, TriangleAlert, XCircle } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef } from 'react';

import { copyText, couldNotCopyText } from '../../lib/clipboard';
import { useUiStore } from '../../state/ui-store';
import { pillOf, plural } from './dbml-pill';
import { useDbmlSession } from './use-dbml-session';

const DbmlEditor = lazy(() => import('./dbml-editor'));

const EMPTY_HINT = 'Type a table to start your schema.';

/**
 * The tab always shows the whole schema (054). The writers and the session still take a scope, so
 * the Selection / Whole schema switch can come back without touching them.
 * TODO(selection-scope): restore the Selection / Whole schema switch (parked by 054).
 */
const SCOPE = 'schema';

/**
 * DBML tab (046 US1–US4, contracts/code-panel-ui.md): the schema as editable DBML, in the code
 * drawer. Edits apply to the canvas 500 ms after typing stops; errors stay in the text and the
 * canvas keeps the last valid schema.
 */
export function DbmlTab() {
  const bindings = useDbmlSession(SCOPE);
  const { view, editorProps } = bindings;
  const { toast } = useToast();
  const announce = useUiStore((s) => s.announce);
  const pill = pillOf(view);
  const warnings = view.problems.filter((p) => p.severity === 'warning').length;

  // Pill changes are announced, never colour only. "Applying…" is too chatty for a screen reader.
  const lastAnnounced = useRef('');
  useEffect(() => {
    const text =
      warnings > 0 && pill.tone === 'ok'
        ? `${pill.text}, ${plural(warnings, 'warning')}`
        : pill.text;
    if (pill.tone === 'busy' || text === lastAnnounced.current) return;
    lastAnnounced.current = text;
    announce(text);
  }, [pill.text, pill.tone, warnings, announce]);

  const copy = async () => {
    toast({ message: (await copyText(bindings.getText())) ? 'Copied DBML' : couldNotCopyText() });
  };

  const Icon =
    pill.tone === 'ok'
      ? Check
      : pill.tone === 'busy'
        ? LoaderCircle
        : pill.tone === 'error'
          ? XCircle
          : TriangleAlert;
  const showHint = view.state === 'synced' && bindings.initialText === '';

  return (
    <section role="region" aria-label="DBML schema" className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1">
        <Suspense fallback={<p className="p-3 text-caption text-ink-muted">Loading editor…</p>}>
          <DbmlEditor
            scope={SCOPE}
            initialText={bindings.initialText}
            ariaLabel="DBML schema"
            problems={view.problems}
            {...editorProps}
          />
        </Suspense>
        {showHint && (
          <p className="pointer-events-none absolute inset-x-12 top-3 text-body-sm text-ink-muted">
            {EMPTY_HINT}
          </p>
        )}
      </div>
      <div className="flex h-10 shrink-0 items-center gap-3 border-t border-hairline px-4">
        <span
          data-tone={pill.tone}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-caption',
            pill.tone === 'ok' && 'bg-success-soft text-success-ink',
            pill.tone === 'busy' && 'bg-surface-2 text-ink-secondary',
            pill.tone === 'error' && 'bg-clay-soft text-clay-ink',
            pill.tone === 'warn' && 'bg-amber-soft text-amber-ink',
          )}
        >
          <Icon aria-hidden className={cn('size-3.5', pill.tone === 'busy' && 'animate-spin')} />
          {pill.text}
        </span>
        {warnings > 0 && pill.tone === 'ok' && (
          <span className="text-caption text-ink-secondary">{plural(warnings, 'warning')}</span>
        )}
        {pill.helper !== '' && <span className="text-caption text-ink-muted">{pill.helper}</span>}
        <div className="flex-1" />
        {view.state === 'confirm' && (
          <Button size="sm" onClick={bindings.applyConfirmed}>
            Apply
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void copy();
          }}
        >
          <Copy />
          Copy
        </Button>
      </div>
    </section>
  );
}

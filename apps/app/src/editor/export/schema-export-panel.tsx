import type { Problem } from '@sododeck/model';
import type { Dialect } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sododeck/ui/components/select';
import { CircleX, Database } from 'lucide-react';
import { useId, useMemo, useState, type Dispatch } from 'react';

import type { SchemaScopes } from '../../db/export/scope';
import { dialectName, isSqlDialect } from '../../db/export/schema-slice';
import type { SqlDialect } from '../../db/export/types';
import { useUiStore } from '../../state/ui-store';
import { DisabledReason } from './disabled-reason';
import type { ExportAction, ExportDialogState, ExportResult } from './export-dialog-state';
import { OptionSwitch } from './option-switch';
import type { SchemaScope } from './types';

const PREVIEW_LINES = 400;
const NOTES_SHOWN = 3;
const FAILED = "Couldn't create this export";
/** The banner is the reason SQL Copy and Download give while blocked (`aria-describedby`). */
export const SQL_BLOCKED_BANNER_ID = 'export-sql-blocked';
const DIALECTS: readonly SqlDialect[] = ['postgres', 'mysql', 'sqlite'];

export type PreviewStatus = 'ready' | ExportDialogState['result']['status'];

function plural(count: number, word: string): string {
  return `${String(count)} ${word}${count === 1 ? '' : 's'}`;
}

/** Line-numbered text (numbers hidden from screen readers), the first 400 lines. */
function TextPreview({ text }: { text: string }) {
  const { lines, more } = useMemo(() => {
    const all = text.endsWith('\n') ? text.slice(0, -1).split('\n') : text.split('\n');
    return { lines: all.slice(0, PREVIEW_LINES), more: Math.max(0, all.length - PREVIEW_LINES) };
  }, [text]);
  return (
    <div className="p-3 font-mono text-caption">
      <div className="flex">
        <pre aria-hidden className="pr-3 text-right text-ink-muted select-none">
          {lines.map((_, i) => String(i + 1)).join('\n')}
        </pre>
        <pre className="min-w-0 whitespace-pre text-ink">{lines.join('\n')}</pre>
      </div>
      {more > 0 && <p className="mt-2 text-ink-secondary">… {plural(more, 'more line')}</p>}
    </div>
  );
}

/**
 * The right column of the export dialog for schema formats (045, contracts/export-dialog-ui.md):
 * scope, dialect chip or picker, problems banner, line-numbered preview, export notes and the SQL
 * options. It only reads the deck; the dialect pick lives in the dialog's reducer.
 */
export function SchemaExportPanel({
  state,
  dispatch,
  scopes,
  scope,
  scopeName,
  problems,
  blocked,
  dialect,
  status,
  ready,
}: {
  state: ExportDialogState;
  dispatch: Dispatch<ExportAction>;
  scopes: SchemaScopes;
  /** The scope in effect (the chosen one, or the first available). */
  scope: SchemaScope;
  /** "the selection", the card's title or "the deck", for the banner. */
  scopeName: string;
  /** The database problems on the tables in scope (`schemaProblems`). */
  problems: readonly Problem[];
  /** SQL Copy and Download are disabled by the deck's "Block SQL export with errors" (052). */
  blocked: boolean;
  dialect: Dialect;
  status: PreviewStatus;
  ready: ExportResult | null;
}) {
  const scopeHeading = useId();
  const notesHeading = useId();
  const [allNotes, setAllNotes] = useState(false);
  const closeExport = useUiStore((s) => s.closeExport);
  const openFlyout = useUiStore((s) => s.openFlyout);
  const isSql = state.format === 'sql';
  const notes = ready?.notes ?? [];
  const shownNotes = allNotes ? notes : notes.slice(0, NOTES_SHOWN);
  const card = scopes.database;

  return (
    <>
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <h3
            id={scopeHeading}
            className="text-micro font-medium tracking-[0.07em] text-ink-muted uppercase"
          >
            Scope
          </h3>
          <SegmentedControl
            aria-labelledby={scopeHeading}
            value={scope}
            className="h-9"
            onValueChange={(value) => {
              dispatch({ type: 'schemaScope', scope: value as SchemaScope });
            }}
          >
            <DisabledReason
              reason={scopes.selection.length === 0 ? 'Select one or more tables' : null}
            >
              <SegmentedControlItem
                value="selection"
                className="whitespace-nowrap"
                disabled={scopes.selection.length === 0}
              >
                Selection
              </SegmentedControlItem>
            </DisabledReason>
            {card !== null && (
              <SegmentedControlItem value="database" className="whitespace-nowrap">
                {card.title}
              </SegmentedControlItem>
            )}
            <SegmentedControlItem value="deck" className="whitespace-nowrap">
              Whole deck
            </SegmentedControlItem>
          </SegmentedControl>
        </div>
        {isSql &&
          (isSqlDialect(dialect) ? (
            <span className="inline-flex items-center gap-1.5 self-end rounded-button bg-surface-2 px-2.5 py-1 text-body-sm text-ink">
              <Database aria-hidden className="size-4 text-ink-secondary" />
              {dialectName(dialect)} · deck dialect
            </span>
          ) : (
            <div className="w-40 self-end">
              <Select
                value={state.sqlDialect ?? ''}
                onValueChange={(value) => {
                  dispatch({ type: 'sqlDialect', dialect: value as SqlDialect });
                }}
              >
                <SelectTrigger aria-label="Dialect">
                  <SelectValue placeholder="Dialect" />
                </SelectTrigger>
                <SelectContent>
                  {DIALECTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {dialectName(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
      </section>
      {problems.length > 0 && (
        <div
          id={SQL_BLOCKED_BANNER_ID}
          role="alert"
          className="flex items-start gap-2.5 rounded-banner bg-clay-soft px-3.5 py-3 text-body-sm text-clay-ink"
        >
          <CircleX aria-hidden className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {blocked
                ? `${String(problems.length)} errors in ${scopeName} · fix them to export SQL`
                : `${plural(problems.length, 'error')} in ${scopeName}`}
            </p>
            <p>
              {problems
                .slice(0, 2)
                .map((p) => p.detail)
                .join(' · ')}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              closeExport();
              openFlyout('problems');
            }}
          >
            Show problems
          </Button>
        </div>
      )}
      <div
        role="region"
        aria-label="Preview"
        className="flex h-62.5 min-w-0 flex-col overflow-auto rounded-row border border-hairline bg-canvas"
      >
        {status === 'error' && (
          <div className="m-auto flex flex-col items-center gap-2 text-body-sm text-ink-secondary">
            <p>{FAILED}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                dispatch({ type: 'retry' });
              }}
            >
              Retry
            </Button>
          </div>
        )}
        {status === 'empty' && (
          <p className="m-auto text-body-sm text-ink-secondary">No tables in this scope</p>
        )}
        {status === 'needs-dialect' && (
          <p className="m-auto text-body-sm text-ink-secondary">Choose a dialect to write SQL</p>
        )}
        {ready?.text != null && <TextPreview text={ready.text} />}
        <p
          role="status"
          aria-live="polite"
          className={status === 'preparing' ? 'm-auto text-body-sm text-ink-secondary' : 'sr-only'}
        >
          {status === 'preparing' ? 'Preparing…' : ''}
        </p>
      </div>
      {notes.length > 0 && (
        <section
          role="status"
          aria-labelledby={notesHeading}
          className="flex flex-col gap-1 rounded-row border border-hairline bg-surface-2 px-3 py-2 text-body-sm text-ink"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 id={notesHeading} className="font-medium">
              {plural(notes.length, 'export note')}
            </h3>
            {notes.length > NOTES_SHOWN && (
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={allNotes}
                onClick={() => {
                  setAllNotes(!allNotes);
                }}
              >
                {allNotes ? 'Show fewer' : 'Show all'}
              </Button>
            )}
          </div>
          <ul className="flex list-disc flex-col gap-0.5 pl-5 text-ink-secondary">
            {shownNotes.map((n, i) => (
              <li key={`${n.kind}-${String(i)}`}>{n.message}</li>
            ))}
          </ul>
        </section>
      )}
      {isSql && (
        <section className="flex flex-col gap-3" aria-label="Options">
          <OptionSwitch
            label="Include enums and indexes"
            checked={state.options.sql.enumsAndIndexes}
            onChange={(value) => {
              dispatch({ type: 'option', options: { sql: { enumsAndIndexes: value } } });
            }}
          />
          <OptionSwitch
            label="Write junction tables for n–n"
            checked={state.options.sql.junctionTables}
            onChange={(value) => {
              dispatch({ type: 'option', options: { sql: { junctionTables: value } } });
            }}
          />
          <OptionSwitch
            label="IF NOT EXISTS"
            checked={state.options.sql.ifNotExists}
            onChange={(value) => {
              dispatch({ type: 'option', options: { sql: { ifNotExists: value } } });
            }}
          />
          <p className="text-caption text-ink-secondary">
            SQL is written in the deck dialect. A Generic deck asks for Postgres, MySQL or SQLite
            here first.
          </p>
        </section>
      )}
    </>
  );
}

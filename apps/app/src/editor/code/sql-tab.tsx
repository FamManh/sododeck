import { deckDialect } from '@sododeck/model';
import { Button } from '@sododeck/ui/components/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sododeck/ui/components/select';
import { useToast } from '@sododeck/ui/components/toast';
import { Copy } from 'lucide-react';
import { lazy, Suspense, useMemo } from 'react';

import { dialectName, isSqlDialect } from '../../db/export/schema-slice';
import type { SqlDialect } from '../../db/export/types';
import { copyText, couldNotCopyText } from '../../lib/clipboard';
import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { createCooldown } from '../cooldown';
import { useSchemaText } from './use-schema-text';

const SqlViewer = lazy(() => import('./sql-viewer'));

export const SQL_READ_ONLY_MESSAGE = 'SQL is read-only here; edit DBML or the canvas';
const READ_ONLY_COOLDOWN_MS = 3000;
const DIALECTS: readonly SqlDialect[] = ['postgres', 'mysql', 'sqlite'];
const LANGUAGE: Record<SqlDialect, string> = { postgres: 'pgsql', mysql: 'mysql', sqlite: 'sql' };

const isDialect = (value: string): value is SqlDialect =>
  value === 'postgres' || value === 'mysql' || value === 'sqlite';

/** The whole schema, always (054); see the note in `dbml-tab.tsx`. TODO(selection-scope) */
const SCOPE = 'schema';

/**
 * SQL tab (046 US5, contracts/code-panel-ui.md): a read-only preview of the writer's SQL for the
 * whole schema, in the deck's dialect (a Generic deck picks a preview dialect). Writes nothing
 * but undo and redo.
 */
export function SqlTab() {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const { toast } = useToast();
  const selection = useUiStore((s) => s.selection.nodes);
  const previewDialect = useUiStore((s) => s.jsonPanel.sqlPreviewDialect);
  const setPreviewDialect = useUiStore((s) => s.setSqlPreviewDialect);
  const announce = useUiStore((s) => s.announce);
  const cooldown = useMemo(() => createCooldown(READ_ONLY_COOLDOWN_MS), []);

  const deckDialectValue = deckDialect(deck);
  const generic = !isSqlDialect(deckDialectValue);
  const dialect: SqlDialect = isSqlDialect(deckDialectValue) ? deckDialectValue : previewDialect;
  const { text, notes, tableCount } = useSchemaText(
    deck,
    { format: 'sql', scope: SCOPE, dialect: generic ? previewDialect : null, selection },
    true,
  );

  const copy = async () => {
    toast({ message: (await copyText(text)) ? 'Copied SQL' : couldNotCopyText() });
  };

  return (
    <section role="region" aria-label="SQL schema" className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        {tableCount === 0 ? (
          <p className="flex h-full items-center justify-center p-4 text-center text-body-sm text-ink-secondary">
            No tables yet. Add one on the canvas or in the DBML tab.
          </p>
        ) : (
          <Suspense fallback={<p className="p-3 text-caption text-ink-muted">Loading editor…</p>}>
            <SqlViewer
              scope={SCOPE}
              language={LANGUAGE[dialect]}
              text={text}
              ariaLabel="SQL schema"
              onReadOnlyAttempt={() => {
                if (cooldown()) announce(SQL_READ_ONLY_MESSAGE);
              }}
              onUndo={() => {
                editor.undo();
              }}
              onRedo={() => {
                editor.redo();
              }}
            />
          </Suspense>
        )}
      </div>
      {notes.length > 0 && (
        <ul
          aria-label="Export notes"
          className="max-h-16 shrink-0 list-disc overflow-auto border-t border-hairline px-8 py-1.5 text-caption text-ink-secondary"
        >
          {notes.map((note, i) => (
            <li key={`${note.kind}-${String(i)}`}>{note.message}</li>
          ))}
        </ul>
      )}
      <div className="flex h-10 shrink-0 items-center gap-3 border-t border-hairline px-4">
        {generic && (
          <div className="w-36">
            <Select
              value={previewDialect}
              onValueChange={(value) => {
                if (isDialect(value)) setPreviewDialect(value);
              }}
            >
              <SelectTrigger aria-label="Preview dialect">
                <SelectValue />
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
        )}
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          disabled={text === ''}
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

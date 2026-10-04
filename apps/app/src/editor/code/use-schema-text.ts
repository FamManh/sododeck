import type { Id, SododeckFile } from '@sododeck/schema';
import { useEffect, useRef, useState } from 'react';

import type { ExportNote } from '../../db/export/notes';
import { schemaExport } from '../../db/export/schema-export';
import { tablesInScope } from '../../db/export/scope';
import { DEFAULT_SQL_OPTIONS, type SqlDialect } from '../../db/export/types';
import type { SchemaScope } from '../../state/json-panel-prefs';
import { DECK_TEXT_THROTTLE_MS } from '../use-throttled-deck-text';

export interface SchemaTextRequest {
  format: 'dbml' | 'sql';
  scope: SchemaScope;
  /** SQL only; `null` = the deck's dialect. */
  dialect: SqlDialect | null;
  /** Selected node ids (the hook keeps the db-table ones). */
  selection: readonly Id[];
}

export interface SchemaText {
  text: string;
  /** Ids of the tables the text holds, deck order. */
  tableIds: readonly Id[];
  notes: readonly ExportNote[];
  tableCount: number;
}

const EMPTY: SchemaText = { text: '', tableIds: [], notes: [], tableCount: 0 };

/**
 * What the text depends on besides the request: Selection reads only its tables, the edges and
 * the enums, so moving an unrelated card never rebuilds it; Whole schema reads the deck.
 */
function inputsOf(deck: SododeckFile, request: SchemaTextRequest, tableIds: readonly Id[]) {
  if (request.scope === 'schema') return [deck];
  const ids = new Set(tableIds);
  return [...deck.nodes.filter((n) => ids.has(n.id)), deck.edges, deck.enums, deck.dialect];
}

const sameInputs = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((value, i) => value === b[i]);

/**
 * The writer's DBML or SQL for the scope (046 R8): `schemaExport` of the snapshot, at most once
 * per 250 ms with a leading and a trailing run, and only while `enabled`. The leading run happens
 * in the effect that enables it, before the lazy editor shows anything.
 */
export function useSchemaText(
  deck: SododeckFile,
  request: SchemaTextRequest,
  enabled: boolean,
): SchemaText {
  const [result, setResult] = useState<SchemaText>(EMPTY);
  const shown = useRef<{ key: string; inputs: readonly unknown[] } | null>(null);
  const lastRun = useRef(-Infinity);
  const wasEnabled = useRef(false);

  const { format, scope, dialect, selection } = request;
  const selectionKey = selection.join('\u0000');

  useEffect(() => {
    if (!enabled) {
      wasEnabled.current = false;
      return;
    }
    const justEnabled = !wasEnabled.current;
    wasEnabled.current = true;
    const req: SchemaTextRequest = { format, scope, dialect, selection };
    const scopeRequest =
      scope === 'schema'
        ? ({ kind: 'deck' } as const)
        : ({ kind: 'selection', tableIds: selection } as const);
    const tableIds = tablesInScope(deck, scopeRequest);
    const key = [format, scope, dialect ?? '', selectionKey].join('|');
    const inputs = inputsOf(deck, req, tableIds);
    const current = shown.current;
    if (current?.key === key && sameInputs(current.inputs, inputs)) return;

    const run = () => {
      shown.current = { key, inputs };
      lastRun.current = Date.now();
      const out = schemaExport(deck, {
        format,
        scope: scopeRequest,
        dialect,
        sql: DEFAULT_SQL_OPTIONS,
      });
      setResult({ text: out.text, tableIds, notes: out.notes, tableCount: out.tableCount });
    };
    // A new format, scope or selection shows at once; plain deck changes wait for the window.
    const wait =
      justEnabled || current?.key !== key
        ? 0
        : lastRun.current + DECK_TEXT_THROTTLE_MS - Date.now();
    if (wait <= 0) {
      run();
      return;
    }
    const timer = setTimeout(run, wait);
    return () => {
      clearTimeout(timer);
    };
    // `selection` is covered by `selectionKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, enabled, format, scope, dialect, selectionKey]);

  return result;
}

import type { DeckEditor } from '@sododeck/model';
import type { Dialect } from '@sododeck/schema';

import type { DialectPlan } from '../../../db/dialect-change';

export const DIALECT_NAMES: Readonly<Record<Dialect, string>> = {
  generic: 'Generic',
  postgres: 'Postgres',
  mysql: 'MySQL',
  sqlite: 'SQLite',
};

/**
 * Writes a dialect change as one undo step: `setDialect` and one `updateColumn` per planned
 * change (052 R6, SC-003). Returns the toast message (the caller adds the Undo button).
 */
export function applyDialectChange(editor: DeckEditor, plan: DialectPlan): string {
  const name = DIALECT_NAMES[plan.to];
  editor.batch(() => {
    editor.setDialect(plan.to);
    for (const { tableId, columnId, after } of plan.changes) {
      editor.updateColumn(tableId, columnId, {
        type: after.type,
        size: after.size ?? null,
        ...(after.increment === undefined ? {} : { increment: true }),
      });
    }
  });
  const n = plan.changes.length;
  return n === 0
    ? `Dialect set to ${name}`
    : `Converted ${String(n)} ${n === 1 ? 'column' : 'columns'} to ${name}`;
}

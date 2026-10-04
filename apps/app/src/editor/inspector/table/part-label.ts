import type { DbIndexPart, Id } from '@sododeck/schema';

/** What an index part shows: the column's name, or the expression text. */
export function partLabel(part: DbIndexPart, columns: readonly { id: Id; name: string }[]): string {
  if (typeof part !== 'string') return part.expr;
  return columns.find((c) => c.id === part)?.name ?? part;
}

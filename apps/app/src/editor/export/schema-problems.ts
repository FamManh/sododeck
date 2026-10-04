/**
 * The deck's database problems that touch the tables a schema export writes (045, research R17):
 * kinds starting with `db-` (040's today, 047's later) whose target is one of those tables, or a
 * relationship with an end there. Pure.
 *
 * Only errors count for now, so the warnings 047 adds (a table without a key, an n–n) neither block
 * 052's "Block SQL export with errors" nor show in the banner.
 * TODO(047): T030 returns `{ errors, warnings }` and the banner lists both.
 */
import type { DeckProblems, Problem } from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';

export function schemaProblems(
  problems: DeckProblems | null,
  tableIds: readonly Id[],
  deck: Pick<SododeckFile, 'edges'>,
): Problem[] {
  if (problems === null || tableIds.length === 0) return [];
  const tables = new Set(tableIds);
  const edgeEnds = new Map(deck.edges.map((e) => [e.id, [e.from, e.to]]));
  const touches = (problem: Problem): boolean => {
    const { target } = problem;
    switch (target.type) {
      case 'node':
        return tables.has(target.id);
      case 'nodes':
        return target.ids.some((id) => tables.has(id));
      case 'edges':
        return target.ids.some((id) => (edgeEnds.get(id) ?? []).some((end) => tables.has(end)));
      case 'object':
        return tables.has(target.ref.id);
      default:
        return false;
    }
  };
  return problems.list.filter(
    (p) => p.kind.startsWith('db-') && p.severity === 'error' && touches(p),
  );
}

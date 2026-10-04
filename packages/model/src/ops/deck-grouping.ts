/**
 * The deck's grouping mode (048, ADR 0034): By group (the groups stored in the deck) or By schema
 * (derived `schema:<name>` groups). A plain scalar in `meta`, like `dialect`; the default is the
 * absent key, and stored `group` / `parent` fields are never touched.
 */
import { assertValid, validateObject } from '../validate';
import { metaMap } from '../layout';
import type { GroupingMode } from '../read';
import type { EditContext } from './context';

/**
 * Sets the mode in one undo step; `'group'` or `null` removes the key. `invalid` (nothing written)
 * for any other value; no transaction when the mode is already as asked.
 */
export function setGroupingMode(ctx: EditContext, mode: GroupingMode | null): void {
  const meta = metaMap(ctx.doc);
  const next = mode === null || mode === 'group' ? undefined : mode;
  if (next !== undefined) assertValid(validateObject('meta', { groupingMode: next }));
  if (meta.get('groupingMode') === next) return;
  ctx.transact(() => {
    if (next === undefined) meta.delete('groupingMode');
    else meta.set('groupingMode', next);
  });
}

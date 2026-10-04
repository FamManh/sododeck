/**
 * Table names on import (044 FR-015, founder decision 2026-10-04): a name already taken in its
 * schema is renamed `name_copy`, `name_copy_2`, … compared case-insensitively, the rule 043 gives
 * pasted tables. TODO(043): use `copyName` from `@sododeck/model` once 043 is merged
 * (specs/044-db-import/integration-043.md). Pure.
 */

/** Lookup key of a name within a schema (absent schema = default), case-insensitive. */
export const nameKey = (name: string, schema: string | undefined): string =>
  `${(schema ?? '').toLowerCase()}\u0000${name.toLowerCase()}`;

/** The first of `name_copy`, `name_copy_2`, `name_copy_3`… for which `isTaken` is false. */
export function copyName(name: string, isTaken: (candidate: string) => boolean): string {
  let candidate = `${name}_copy`;
  for (let n = 2; isTaken(candidate); n++) candidate = `${name}_copy_${String(n)}`;
  return candidate;
}

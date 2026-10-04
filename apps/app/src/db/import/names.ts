/**
 * Table names on import (044 FR-015, founder decision 2026-10-04): a name already taken in its
 * schema is renamed with 043's paste rule, `copyName` from the model (`name_copy`,
 * `name_copy_2`, … compared case-insensitively). Pure.
 */

/** Lookup key of a name within a schema (absent schema = default), case-insensitive. */
export const nameKey = (name: string, schema: string | undefined): string =>
  `${(schema ?? '').toLowerCase()}\u0000${name.toLowerCase()}`;

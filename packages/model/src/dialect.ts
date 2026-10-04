/** The deck's SQL dialect (040, research R6): one per deck, `generic` when none is stored. */
import { jsonSchema, type Dialect, type SododeckFile } from '@sododeck/schema';
import * as Y from 'yjs';

import { metaMap, type DeckDoc } from './layout';

const DIALECTS: readonly string[] = jsonSchema.$defs.Dialect.enum;

function isDialect(value: unknown): value is Dialect {
  return typeof value === 'string' && DIALECTS.includes(value);
}

/** The dialect of a plain deck or a deck document; absent (or unreadable) means `generic`. */
export function deckDialect(deck: Pick<SododeckFile, 'dialect'> | DeckDoc): Dialect {
  const value = deck instanceof Y.Doc ? metaMap(deck).get('dialect') : deck.dialect;
  return isDialect(value) ? value : 'generic';
}

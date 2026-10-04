/** The deck's table display with defaults filled in (041, research R4). */
import type { DbDetail, SododeckFile } from '@sododeck/schema';

/** Deck detail: `auto` when the file stores none (every column from 90 % zoom). */
export type DeckTableDetail = DbDetail | 'auto';

export interface ResolvedTableDisplay {
  detail: DeckTableDetail;
  hideTypes: boolean;
  hideNullable: boolean;
  hideNotes: boolean;
  hideIndexes: boolean;
}

const DETAILS: readonly string[] = ['names', 'keys', 'all'];

/** Reads `tableDisplay`: absent keys mean Auto detail and every part shown. */
export function tableDisplayOf(deck: Pick<SododeckFile, 'tableDisplay'>): ResolvedTableDisplay {
  const stored = deck.tableDisplay ?? {};
  const detail = stored.detail;
  return {
    detail: detail !== undefined && DETAILS.includes(detail) ? detail : 'auto',
    hideTypes: stored.hideTypes === true,
    hideNullable: stored.hideNullable === true,
    hideNotes: stored.hideNotes === true,
    hideIndexes: stored.hideIndexes === true,
  };
}

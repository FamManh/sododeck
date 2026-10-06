/** The deck's table display (041, research R4), relationship display (042) and canvas background (ADR 0044), defaults filled in. */
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

/** Relationship display with defaults: `follow` labels the Labels tool; `crow` is crow's foot. */
export interface ResolvedRelationshipDisplay {
  hideEnds: boolean;
  labels: 'follow' | 'hover' | 'always' | 'off';
  notation: 'crow' | 'numeric';
}

const LABELS: readonly string[] = ['hover', 'always', 'off'];

/** Reads `relationshipDisplay` (042): absent keys mean ends shown, Follow labels, crow's foot. */
export function relationshipDisplayOf(
  deck: Pick<SododeckFile, 'relationshipDisplay'>,
): ResolvedRelationshipDisplay {
  const stored = deck.relationshipDisplay ?? {};
  const labels = stored.labels;
  return {
    hideEnds: stored.hideEnds === true,
    labels: labels !== undefined && LABELS.includes(labels) ? labels : 'follow',
    notation: stored.notation === 'numeric' ? 'numeric' : 'crow',
  };
}

/** Canvas background with defaults (ADR 0044): `color` undefined follows the theme. */
export interface ResolvedCanvasBackground {
  pattern: 'dots' | 'grid' | 'none';
  color: string | undefined;
}

const HEX = /^#[0-9a-f]{6}$/;

/** Reads `canvasBackground` (ADR 0044): absent keys mean dots on the theme's canvas colour. */
export function canvasBackgroundOf(
  deck: Pick<SododeckFile, 'canvasBackground'>,
): ResolvedCanvasBackground {
  const stored = deck.canvasBackground ?? {};
  const pattern = stored.pattern;
  const color = stored.color;
  return {
    pattern: pattern === 'grid' || pattern === 'none' ? pattern : 'dots',
    color: color !== undefined && HEX.test(color) ? color : undefined,
  };
}

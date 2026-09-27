/** Addresses of the rule editor (008 FR-018): `/deck/:deckId/rules/:ruleId?`. */
export function rulesPath(deckId: string | undefined, ruleId?: string): string {
  const base = `/deck/${deckId ?? ''}/rules`;
  return ruleId === undefined ? base : `${base}/${encodeURIComponent(ruleId)}`;
}

export function canvasPath(deckId: string | undefined): string {
  return `/deck/${deckId ?? ''}`;
}

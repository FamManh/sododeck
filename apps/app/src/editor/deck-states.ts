/** The states of a card that can hold at the same time (029 US2). */
export interface DeckStateFlags {
  selected: boolean;
  hasProblem: boolean;
  /** A valid drop target while a connection is drawn. */
  connectTarget: boolean;
  /** An invalid drop target while a connection is drawn. */
  connectRefused: boolean;
  /** From or to of the current flow step. */
  currentStep: boolean;
}

/**
 * The state class of each flag that is on. One class per state, never one replacing another, so
 * the CSS in `index.css` composes them (selected + problem keep both rings; a current step with a
 * problem keeps the lift and the problem ring).
 */
export function deckStateClasses(flags: DeckStateFlags): string[] {
  const out: string[] = [];
  if (flags.selected) out.push('selected');
  if (flags.hasProblem) out.push('has-problem');
  if (flags.connectTarget) out.push('connect-target');
  if (flags.connectRefused) out.push('connect-refused');
  if (flags.currentStep) out.push('current-step');
  return out;
}

import { DeckEditError, type DeckEditor } from '@sododeck/model';

import { oneStep } from './one-step';

/**
 * Runs a field edit as one undo step (032) and returns the model's refusal message, or null when
 * it was written. Refusals (an empty or duplicate name, a bad value) write nothing.
 */
export function tryFieldEdit(editor: DeckEditor, write: () => void): string | null {
  try {
    oneStep(editor, write);
    return null;
  } catch (error) {
    if (error instanceof DeckEditError) return error.issues[0]?.message ?? 'Not allowed.';
    throw error;
  }
}

export const countText = (n: number, noun: string) => `${String(n)} ${noun}${n === 1 ? '' : 's'}`;

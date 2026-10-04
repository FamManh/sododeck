import type { SessionView } from './dbml-session';

export const plural = (n: number, word: string) => `${String(n)} ${word}${n === 1 ? '' : 's'}`;

export interface Pill {
  text: string;
  helper: string;
  tone: 'ok' | 'busy' | 'error' | 'warn';
}

/** The footer pill of a session view (contracts/code-panel-ui.md "Footer (DBML)"). */
export function pillOf(view: SessionView): Pill {
  const errors = view.problems.filter((p) => p.severity === 'error').length;
  switch (view.state) {
    case 'dirty':
      return { text: 'Applying…', helper: 'Edits apply as you type', tone: 'busy' };
    case 'invalid':
      return {
        text: `Can't apply: fix ${plural(errors, 'error')}`,
        helper: 'Canvas keeps the last valid schema',
        tone: 'error',
      };
    case 'confirm':
      return {
        text: `This removes all ${plural(view.confirmCount, 'table')}`,
        helper: '',
        tone: 'warn',
      };
    case 'synced':
    case 'applied':
      return { text: 'Applied', helper: 'Edits apply as you type', tone: 'ok' };
  }
}

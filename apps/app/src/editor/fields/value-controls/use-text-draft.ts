import { useState, type FocusEvent, type KeyboardEvent } from 'react';

/**
 * A text draft that commits on Enter or blur and reverts on Esc (032 value controls). While the
 * control is not being edited it shows the stored value, so an edit from elsewhere shows at once.
 * `commit` returns an error message to keep the draft open with it, or null when it is done.
 */
export function useTextDraft(shown: string, commit: (text: string) => string | null) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const finish = () => {
    if (draft === null) return;
    if (draft === shown) {
      setDraft(null);
      setError(null);
      return;
    }
    const message = commit(draft);
    setError(message);
    if (message === null) setDraft(null);
  };
  return {
    value: draft ?? shown,
    error,
    onChange: (text: string) => {
      setDraft(text);
      if (error !== null) setError(null);
    },
    onFocus: () => {
      setDraft((current) => current ?? shown);
    },
    onBlur: (_event?: FocusEvent) => {
      finish();
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        finish();
      } else if (event.key === 'Escape' && draft !== null) {
        event.preventDefault();
        event.stopPropagation();
        setDraft(null);
        setError(null);
      }
    },
  };
}

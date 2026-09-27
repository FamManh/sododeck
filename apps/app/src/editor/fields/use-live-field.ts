import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import { useEditor } from '../../model/use-editor';

interface LiveFieldOptions {
  /** Field name, for the "<Label> can’t be empty." error. */
  label: string;
  /** The document's value. */
  value: string;
  /** Writes the trimmed text to the document; `''` means "clear" for optional fields. */
  onWrite: (text: string) => void;
  /** An empty value is never written; on blur it reverts with an error. */
  required?: boolean;
  /** Textareas: Enter types a newline, ⌘↵ / Ctrl+↵ ends the edit. */
  multiline?: boolean;
}

export interface LiveField {
  /** What the control shows: the draft while typing, else the document's value. */
  value: string;
  error: string | undefined;
  onChange: (text: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

const frame = (fn: () => void): (() => void) => {
  if (typeof requestAnimationFrame !== 'function') {
    fn();
    return () => undefined;
  }
  const id = requestAnimationFrame(fn);
  return () => {
    cancelAnimationFrame(id);
  };
};

/**
 * A text field that saves as the user types (FR-002, research R4): the first change after focus
 * begins an editor gesture, writes go out at most once per animation frame, and blur, Enter or
 * unmount end the gesture, so one focus session is one undo step however slowly the user types.
 * Esc writes back the value from before focus. While the field has focus ⌘Z stays the browser's
 * (`isTextTarget`), so model undo never splits a half-typed value.
 */
export function useLiveField({
  label,
  value,
  onWrite,
  required = false,
  multiline = false,
}: LiveFieldOptions): LiveField {
  const editor = useEditor();
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  // Latest options for writes that run after render (frames, blur, unmount).
  const latest = useRef({ onWrite, required });
  useLayoutEffect(() => {
    latest.current = { onWrite, required };
  });
  const session = useRef<{
    initial: string;
    gesture: boolean;
    pending: string | null;
    cancel: (() => void) | null;
  }>({ initial: value, gesture: false, pending: null, cancel: null });

  const flush = useCallback(() => {
    const s = session.current;
    s.cancel?.();
    s.cancel = null;
    if (s.pending === null) return;
    const text = s.pending.trim();
    s.pending = null;
    if (latest.current.required && text === '') return;
    latest.current.onWrite(text);
  }, []);

  const end = useCallback(() => {
    flush();
    const s = session.current;
    if (s.gesture) {
      s.gesture = false;
      editor.endGesture();
    }
  }, [editor, flush]);

  const revert = () => {
    const s = session.current;
    s.pending = s.gesture ? s.initial : null;
    end();
    setDraft(null);
  };

  // Unmount (selection change mid-typing): save what was typed and close the gesture.
  useEffect(
    () => () => {
      end();
    },
    [end],
  );

  return {
    value: draft ?? value,
    error: invalid ? `${label} can’t be empty.` : undefined,
    onFocus: () => {
      session.current.initial = value;
    },
    onChange: (text) => {
      const s = session.current;
      setDraft(text);
      setInvalid(false);
      if (!s.gesture) {
        s.gesture = true;
        editor.beginGesture();
      }
      s.pending = text;
      s.cancel ??= frame(() => {
        s.cancel = null;
        flush();
      });
    },
    onBlur: () => {
      if (draft !== null && required && draft.trim() === '') {
        setInvalid(true);
        revert();
        return;
      }
      end();
      setDraft(null);
    },
    onKeyDown: (event) => {
      const commitKey = event.key === 'Enter' && (!multiline || event.metaKey || event.ctrlKey);
      if (commitKey) {
        event.preventDefault();
        if (draft !== null && required && draft.trim() === '') {
          setInvalid(true);
          return;
        }
        end();
        setDraft(null);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setInvalid(false);
        revert();
      }
    },
  };
}

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import { useEditor } from '../../model/use-editor';
import { rebaseCaret, rebaseDraft } from './rebase-draft';

interface LiveFieldOptions {
  /** Field name, for the "<Label> can’t be empty." error. */
  label: string;
  /** The document's value. */
  value: string;
  /** Writes the trimmed text to the document; `''` means "clear" for optional fields. */
  onWrite: (text: string) => void;
  /** An empty value is never written; on blur it reverts with an error. */
  required?: boolean;
  /**
   * A message for a draft that must not be saved (a duplicate name). While it returns one, nothing
   * is written and `error` shows it; on blur the field reverts to its value from before focus.
   * Receives the trimmed text.
   */
  validate?: (text: string) => string | undefined;
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

type TextControl = HTMLInputElement | HTMLTextAreaElement;

const isTextControl = (element: Element | null): element is TextControl =>
  element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;

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
 *
 * A change from elsewhere (another tab) while the user types is merged into the draft rather than
 * overwritten by it, and the caret stays with the user's characters (036 FR-016, R7).
 */
export function useLiveField({
  label,
  value,
  onWrite,
  required = false,
  validate,
  multiline = false,
}: LiveFieldOptions): LiveField {
  const editor = useEditor();
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  // Latest options for writes that run after render (frames, blur, unmount).
  const latest = useRef({ onWrite, required, validate });
  useLayoutEffect(() => {
    latest.current = { onWrite, required, validate };
  });
  const session = useRef<{
    initial: string;
    /** The document value the draft was typed over: the value at focus, then each own write. */
    basis: string;
    /** The last `value` seen, so only a real change of it counts. */
    seen: string;
    /**
     * Texts this field wrote since focus. Callers may pass the document value a render late (a
     * canvas node's data), so an own write can arrive after a newer one: it is not an outside change.
     */
    writes: Set<string>;
    gesture: boolean;
    pending: string | null;
    cancel: (() => void) | null;
    /** Caret to put back after a rebase re-renders the control. */
    caret: { element: TextControl; at: number } | null;
  }>({
    initial: value,
    basis: value,
    seen: value,
    writes: new Set(),
    gesture: false,
    pending: null,
    cancel: null,
    caret: null,
  });

  const flush = useCallback(() => {
    const s = session.current;
    s.cancel?.();
    s.cancel = null;
    if (s.pending === null) return;
    const text = s.pending.trim();
    s.pending = null;
    if (latest.current.required && text === '') return;
    if (latest.current.validate?.(text) !== undefined) return;
    s.basis = text;
    s.writes.add(text);
    latest.current.onWrite(text);
  }, []);

  // A document value that is not this field's own write, while it holds typing: rebase the draft
  // onto it (the outside change replayed onto what the user typed), keeping the caret in place.
  useLayoutEffect(() => {
    const s = session.current;
    if (value === s.seen) return;
    s.seen = value;
    if (draft === null) {
      s.basis = value;
      s.writes.clear();
      return;
    }
    if (value === s.basis || s.writes.has(value)) return;
    const next = rebaseDraft(s.basis, value, draft);
    const element = document.activeElement;
    if (isTextControl(element) && element.selectionStart !== null) {
      s.caret = { element, at: rebaseCaret(s.basis, value, draft, element.selectionStart) };
    }
    s.basis = value;
    s.writes.clear();
    if (s.pending !== null) s.pending = next;
    setDraft(next);
  }, [value, draft]);

  useLayoutEffect(() => {
    const s = session.current;
    if (s.caret === null) return;
    const { element, at } = s.caret;
    s.caret = null;
    if (document.activeElement === element) element.setSelectionRange(at, at);
  }, [draft]);

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
    error: message ?? (invalid ? `${label} can’t be empty.` : undefined),
    onFocus: () => {
      const s = session.current;
      s.initial = value;
      s.basis = value;
      s.seen = value;
      s.writes.clear();
    },
    onChange: (text) => {
      const s = session.current;
      setDraft(text);
      setInvalid(false);
      const problem = validate?.(text.trim());
      setMessage(problem);
      if (problem !== undefined) {
        // Nothing invalid goes out; a write queued from an earlier valid draft is dropped too.
        s.pending = null;
        s.cancel?.();
        s.cancel = null;
        return;
      }
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
      if (draft !== null && validate?.(draft.trim()) !== undefined) {
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
        if (draft !== null && validate?.(draft.trim()) !== undefined) return;
        end();
        setDraft(null);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setInvalid(false);
        setMessage(undefined);
        revert();
      }
    },
  };
}

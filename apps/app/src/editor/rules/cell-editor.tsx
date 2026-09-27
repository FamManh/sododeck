import { useRef, useState } from 'react';

/**
 * The input that edits one cell in place. Enter commits and moves down, Tab commits, blur
 * commits, Esc cancels. Keys never reach the grid while editing.
 */
export function CellEditor({
  label,
  initial,
  onDone,
}: {
  label: string;
  initial: string;
  /** `null`: cancelled. `down`: Enter (the grid moves to the next row). */
  onDone: (value: string | null, move: 'down' | 'stay') => void;
}) {
  const [text, setText] = useState(initial);
  const done = useRef(false);
  const finish = (value: string | null, move: 'down' | 'stay') => {
    if (done.current) return;
    done.current = true;
    onDone(value, move);
  };
  return (
    <input
      aria-label={label}
      autoFocus
      value={text}
      onFocus={(event) => {
        // Typing a character starts with it; Enter / F2 keep the value, caret at the end.
        const end = event.currentTarget.value.length;
        event.currentTarget.setSelectionRange(end, end);
      }}
      onChange={(event) => {
        setText(event.target.value);
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') {
          event.preventDefault();
          finish(text, 'down');
        } else if (event.key === 'Escape') {
          event.preventDefault();
          finish(null, 'stay');
        } else if (event.key === 'Tab') {
          finish(text, 'stay');
        }
      }}
      onBlur={() => {
        finish(text, 'stay');
      }}
      className="h-8 w-full min-w-16 rounded-row border border-primary bg-surface px-2 font-mono text-body-sm text-ink outline-none"
    />
  );
}

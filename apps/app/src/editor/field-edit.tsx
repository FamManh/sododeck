import { Input } from '@sododeck/ui/components/input';
import { useId, useState } from 'react';

interface FieldEditProps {
  label: string;
  /** The committed value, owned by the document. */
  value: string;
  /** Called on Enter or blur when the value changed; an empty value only when `allowEmpty`. */
  onCommit: (value: string) => void;
  allowEmpty?: boolean;
  placeholder?: string;
}

/**
 * Labelled text field that writes once per commit (Enter or blur), so a whole edit is one undo
 * step (research R9). Escape reverts. A refused empty value shows the invalid state and keeps
 * the old value in the document.
 */
export function FieldEdit({
  label,
  value,
  onCommit,
  allowEmpty = false,
  placeholder,
}: FieldEditProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const shown = draft ?? value;

  const commit = (onRefuse: 'keep' | 'revert') => {
    if (draft === null) return;
    const next = draft.trim();
    if (next === '' && !allowEmpty) {
      if (onRefuse === 'revert') {
        setDraft(null);
        setInvalid(false);
      } else {
        setInvalid(true);
      }
      return;
    }
    if (next !== value) onCommit(next);
    setDraft(null);
    setInvalid(false);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-micro text-ink-muted uppercase">
        {label}
      </label>
      <Input
        id={id}
        aria-label={label}
        value={shown}
        placeholder={placeholder}
        invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={(event) => {
          setDraft(event.target.value);
          setInvalid(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit('keep');
          } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setDraft(null);
            setInvalid(false);
          }
        }}
        onBlur={() => {
          commit('revert');
        }}
      />
      {invalid && (
        <span id={`${id}-error`} className="text-caption text-clay-ink">
          {label} can’t be empty.
        </span>
      )}
    </div>
  );
}

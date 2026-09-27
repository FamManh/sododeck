import { Input } from '@sododeck/ui/components/input';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { CircleAlert } from 'lucide-react';
import { useId, useState } from 'react';

interface FieldEditProps {
  label: string;
  /** The committed value, owned by the document. */
  value: string;
  /** Called on Enter or blur when the value changed; an empty value only when `allowEmpty`. */
  onCommit: (value: string) => void;
  allowEmpty?: boolean;
  placeholder?: string;
  /** An error from outside (e.g. Done with an empty branch field), shown with an icon. */
  error?: string;
  /** Id of a `<datalist>` of suggestions. */
  list?: string;
  /** Monospace value (conditions, SLA). */
  mono?: boolean;
  /** Id of the input, so callers can focus it. */
  id?: string;
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
  error,
  list,
  mono = false,
  id: inputId,
}: FieldEditProps) {
  const ownId = useId();
  const id = inputId ?? ownId;
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const shown = draft ?? value;
  const message = invalid ? `${label} can’t be empty.` : error;

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
        list={list}
        // Not Input's `invalid` prop: it changes the DOM shape, which would drop focus mid-edit.
        aria-invalid={message !== undefined || undefined}
        className={cn(
          message !== undefined && 'border-clay-ink focus:border-clay-ink',
          mono && 'font-mono',
        )}
        aria-describedby={message === undefined ? undefined : `${id}-error`}
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
      {message !== undefined && (
        <span id={`${id}-error`} className="flex items-center gap-1 text-caption text-clay-ink">
          <CircleAlert aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5 shrink-0" />
          {message}
        </span>
      )}
    </div>
  );
}

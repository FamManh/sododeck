import { Textarea } from '@sododeck/ui/components/textarea';
import { useId, useState } from 'react';

/**
 * Labelled markdown field that writes once per commit (blur, or ⌘↵), so a whole edit is one undo
 * step, like `FieldEdit`. Esc reverts. An empty value clears the field.
 */
export function TextareaEdit({
  label,
  value,
  onCommit,
  placeholder,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const next = draft.trim();
    if (next !== value) onCommit(next);
    setDraft(null);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-micro text-ink-muted uppercase">
        {label} · Markdown
      </label>
      <Textarea
        id={id}
        aria-label={label}
        value={draft ?? value}
        placeholder={placeholder}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setDraft(null);
          }
        }}
        onBlur={commit}
      />
    </div>
  );
}

import { useRef, useState } from 'react';
import type * as React from 'react';

import { TagChip } from '@sododeck/ui/components/tag-chip';
import { focusRing } from '@sododeck/ui/lib/focus';
import { addTag, removeTag } from '@sododeck/ui/lib/tags';
import { cn } from '@sododeck/ui/lib/utils';

type TagInputProps = Omit<React.ComponentProps<'div'>, 'onChange'> & {
  /** Current tags, owned by the caller (document data lives in Yjs, not here). */
  value: readonly string[];
  onValueChange: (tags: readonly string[]) => void;
  /** Accessible name of the add field. */
  label: string;
  placeholder?: string;
};

/**
 * Tag chips plus a dashed "+ tag" field. Enter adds (trimmed, lower-cased, de-duplicated).
 * After a removal, focus moves to the next chip, or to the add field if none is left.
 */
function TagInput({
  value,
  onValueChange,
  label,
  placeholder = '+ tag',
  className,
  ...props
}: TagInputProps) {
  const [draft, setDraft] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const removeButtons = useRef(new Map<string, HTMLButtonElement>());
  const focusAfterRemove = useRef<string | null>(null);

  function remove(tag: string) {
    const index = value.indexOf(tag);
    focusAfterRemove.current = value[index + 1] ?? null;
    onValueChange(removeTag(value, tag));
    // Focus once the removed chip is gone.
    queueMicrotask(() => {
      const next = focusAfterRemove.current;
      const target = next === null ? undefined : removeButtons.current.get(next);
      (target ?? field.current)?.focus();
    });
  }

  return (
    <div
      data-slot="tag-input"
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      {...props}
    >
      <ul className="contents">
        {value.map((tag) => (
          <li key={tag} className="contents">
            <TagChip
              label={tag}
              onRemove={() => {
                remove(tag);
              }}
              removeRef={(button) => {
                if (button) removeButtons.current.set(tag, button);
                else removeButtons.current.delete(tag);
              }}
            />
          </li>
        ))}
      </ul>
      <input
        ref={field}
        aria-label={label}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          const next = addTag(value, draft);
          if (next !== value) onValueChange(next);
          setDraft('');
        }}
        className={cn(
          'h-6.5 w-24 rounded-full border border-dashed border-border bg-transparent px-2.5 text-body-sm text-ink placeholder:text-ink-muted focus:border-primary',
          focusRing,
        )}
      />
    </div>
  );
}

export { TagInput };

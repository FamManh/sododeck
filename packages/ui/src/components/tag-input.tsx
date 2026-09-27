import { useMemo, useRef, useState } from 'react';
import type * as React from 'react';

import { Combobox } from '@sododeck/ui/components/combobox';
import { TagChip } from '@sododeck/ui/components/tag-chip';
import { addTag, removeTag } from '@sododeck/ui/lib/tags';
import { cn } from '@sododeck/ui/lib/utils';

type TagInputProps = Omit<React.ComponentProps<'div'>, 'onChange'> & {
  /** Current tags, owned by the caller (document data lives in Yjs, not here). */
  value: readonly string[];
  onValueChange: (tags: readonly string[]) => void;
  /** Accessible name of the add field. */
  label: string;
  /** Accessible name of the chip list. Default "Tags". */
  listLabel?: string;
  placeholder?: string;
  /** Tags to suggest while typing (e.g. every tag in the deck); present ones are left out. */
  suggestions?: readonly string[];
};

/**
 * Tag chips plus a dashed "+ tag" field. Enter adds (trimmed, lower-cased, de-duplicated);
 * choosing a suggestion adds it; Backspace in the empty field removes the last tag. After a
 * removal, focus moves to the next chip, or to the add field if none is left.
 */
function TagInput({
  value,
  onValueChange,
  label,
  listLabel = 'Tags',
  placeholder = '+ tag',
  suggestions = [],
  className,
  ...props
}: TagInputProps) {
  const [draft, setDraft] = useState('');
  const field = useRef<HTMLDivElement>(null);
  const removeButtons = useRef(new Map<string, HTMLButtonElement>());
  const focusAfterRemove = useRef<string | null>(null);
  const options = useMemo(
    () => suggestions.filter((s) => !value.includes(s)),
    [suggestions, value],
  );

  const focusField = () => field.current?.querySelector('input')?.focus();

  function remove(tag: string) {
    const index = value.indexOf(tag);
    focusAfterRemove.current = value[index + 1] ?? null;
    onValueChange(removeTag(value, tag));
    // Focus once the removed chip is gone.
    queueMicrotask(() => {
      const next = focusAfterRemove.current;
      const target = next === null ? undefined : removeButtons.current.get(next);
      if (target) target.focus();
      else focusField();
    });
  }

  function add(raw: string) {
    const next = addTag(value, raw);
    if (next !== value) onValueChange(next);
    setDraft('');
  }

  return (
    <div
      data-slot="tag-input"
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      {...props}
    >
      <ul aria-label={listLabel} className="contents">
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
      <div ref={field} className="contents">
        <Combobox
          mode="free"
          label={label}
          listLabel="Tag suggestions"
          value={draft}
          onValueChange={setDraft}
          onOptionSelect={add}
          options={options}
          chevron={false}
          placeholder={placeholder}
          wrapperClassName="w-24"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add(draft);
            } else if (event.key === 'Backspace' && draft === '') {
              const last = value.at(-1);
              if (last !== undefined) {
                event.preventDefault();
                onValueChange(removeTag(value, last));
              }
            }
          }}
          className="h-6.5 rounded-full border-dashed bg-transparent px-2.5 text-body-sm"
        />
      </div>
    </div>
  );
}

export { TagInput };

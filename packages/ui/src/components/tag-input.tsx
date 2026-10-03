import { useMemo, useRef, useState } from 'react';
import type * as React from 'react';

import { Combobox } from '@sododeck/ui/components/combobox';
import { TagChip } from '@sododeck/ui/components/tag-chip';
import { addTag, removeTag, tagKey } from '@sododeck/ui/lib/tags';
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
  /** At most this many tags: at the limit the add field gives way to a "<max> tags max" note. */
  max?: number;
};

/**
 * Tag chips plus a dashed "+ tag" field. Enter adds (trimmed, case kept, de-duplicated by `tagKey`);
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
  max = Infinity,
  className,
  ...props
}: TagInputProps) {
  const full = value.length >= max;
  const [draft, setDraft] = useState('');
  const field = useRef<HTMLDivElement>(null);
  const removeButtons = useRef(new Map<string, HTMLButtonElement>());
  const focusAfterRemove = useRef<string | null>(null);
  const options = useMemo(() => {
    const held = new Set(value.map(tagKey));
    return suggestions.filter((s) => !held.has(tagKey(s)));
  }, [suggestions, value]);

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
    const next = addTag(value, raw, max);
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
      {full && (
        <span role="note" className="text-caption text-ink-muted">
          {String(max)} tags max
        </span>
      )}
      {!full && (
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
      )}
    </div>
  );
}

export { TagInput };

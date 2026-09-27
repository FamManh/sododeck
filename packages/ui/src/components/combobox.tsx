import { Check, ChevronDown } from 'lucide-react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { useId, useMemo, useRef, useState } from 'react';
import type * as React from 'react';

import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';

export interface ComboboxOption {
  value: string;
  label: string;
}

type ComboboxProps = Omit<
  React.ComponentProps<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'role' | 'type'
> & {
  /** `free`: any text is the value (owner). `pick`: the value must be one of the options. */
  mode: 'free' | 'pick';
  /** Free: the text. Pick: the selected option's value (`''` for none). */
  value: string;
  /** Free: every keystroke and every chosen option. Pick: only a chosen option. */
  onValueChange: (value: string) => void;
  /** Called instead of `onValueChange` when an option is chosen (e.g. a tag input adds it). */
  onOptionSelect?: (value: string) => void;
  options: readonly (string | ComboboxOption)[];
  /** Accessible name of the field, unless `aria-labelledby` or a `<label>` names it. */
  label?: string;
  /** Accessible name of the suggestion list. */
  listLabel: string;
  /** Default 8. */
  maxOptions?: number;
  /** Shows the chevron that makes the field look like a select (§g-26). Default true. */
  chevron?: boolean;
  wrapperClassName?: string;
};

const toOption = (o: string | ComboboxOption): ComboboxOption =>
  typeof o === 'string' ? { value: o, label: o } : o;

/**
 * A text field with a suggestion list (WAI-ARIA combobox with list autocomplete), built on Radix
 * Popover and styled like the `Select` trigger. The list filters by "contains", ignoring case,
 * and shows at most `maxOptions`. ↑/↓ move, Enter chooses, Esc closes; keys the list does not
 * use (Enter or Esc with the list closed) reach the caller's `onKeyDown`.
 */
function Combobox({
  mode,
  value,
  onValueChange,
  onOptionSelect,
  options,
  label,
  listLabel,
  maxOptions = 8,
  chevron = true,
  className,
  wrapperClassName,
  onKeyDown,
  onBlur,
  onFocus,
  id,
  ...props
}: ComboboxProps) {
  const listId = useId();
  const optionId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Filter text; '' shows every option (opened without typing).
  const [query, setQuery] = useState('');
  // Pick mode: text typed since focus, or null to show the selected label.
  const [draft, setDraft] = useState<string | null>(null);

  const all = useMemo(() => options.map(toOption), [options]);
  const selectedLabel = all.find((o) => o.value === value)?.label ?? '';
  const text = mode === 'free' ? value : (draft ?? selectedLabel);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((o) => q === '' || o.label.toLowerCase().includes(q)).slice(0, maxOptions);
  }, [all, query, maxOptions]);
  const expanded = open && shown.length > 0;

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function choose(option: ComboboxOption) {
    if (onOptionSelect) onOptionSelect(option.value);
    else onValueChange(option.value);
    setDraft(null);
    close();
  }

  function openList(q: string) {
    setQuery(q);
    setActive(-1);
    setOpen(true);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      if (!expanded) {
        openList('');
        setActive(step === 1 ? 0 : Math.min(all.length, maxOptions) - 1);
        return;
      }
      setActive((i) => (i + step + shown.length) % shown.length);
      return;
    }
    if (event.key === 'Enter' && expanded) {
      const option =
        shown[active] ?? (mode === 'pick' && shown.length === 1 ? shown[0] : undefined);
      if (option !== undefined) {
        event.preventDefault();
        choose(option);
        return;
      }
    }
    if (event.key === 'Escape' && expanded) {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    onKeyDown?.(event);
  }

  const activeOption = expanded ? shown[active] : undefined;

  return (
    <PopoverPrimitive.Root
      open={expanded}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <PopoverPrimitive.Anchor asChild>
        <div
          data-slot="combobox"
          className={cn('relative flex w-full min-w-0 items-center', wrapperClassName)}
        >
          <input
            ref={input}
            id={id}
            type="text"
            role="combobox"
            aria-label={label}
            aria-autocomplete="list"
            aria-expanded={expanded}
            aria-controls={expanded ? listId : undefined}
            aria-activedescendant={
              activeOption === undefined ? undefined : `${optionId}-${String(active)}`
            }
            autoComplete="off"
            value={text}
            onChange={(event) => {
              const next = event.target.value;
              if (mode === 'free') onValueChange(next);
              else setDraft(next);
              openList(next);
            }}
            onClick={() => {
              if (!expanded) openList('');
            }}
            onKeyDown={handleKeyDown}
            onFocus={onFocus}
            onBlur={(event) => {
              setDraft(null);
              close();
              onBlur?.(event);
            }}
            className={cn(
              'h-9 w-full min-w-0 rounded-input border border-border bg-surface pl-[11px] text-body text-ink transition-colors placeholder:text-ink-muted focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-clay-ink',
              chevron ? 'pr-8' : 'pr-[11px]',
              focusRing,
              className,
            )}
            {...props}
          />
          {chevron && (
            <ChevronDown
              aria-hidden
              strokeWidth={ICON_STROKE_WIDTH}
              className="pointer-events-none absolute right-2.5 size-4 text-ink-muted"
            />
          )}
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          role="presentation"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            // The field handles Esc, so a caller's Esc (revert) never fires while the list closes.
            event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (event.target instanceof Node && input.current?.contains(event.target)) {
              event.preventDefault();
            }
          }}
          className="z-50 max-h-72 min-w-(--radix-popper-anchor-width) overflow-y-auto rounded-card border border-border bg-surface p-1 text-ink shadow-float outline-none"
        >
          <ul id={listId} role="listbox" aria-label={listLabel}>
            {shown.map((option, i) => (
              <li
                key={option.value}
                id={`${optionId}-${String(i)}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(event) => {
                  // Keep focus in the field.
                  event.preventDefault();
                }}
                onClick={() => {
                  choose(option);
                }}
                onMouseMove={() => {
                  setActive(i);
                }}
                className={cn(
                  'relative flex h-8 cursor-pointer items-center truncate rounded-row pr-8 pl-2.5 text-body select-none',
                  i === active && 'bg-surface-2',
                )}
              >
                {option.label}
                {mode === 'pick' && option.value === value && (
                  <Check
                    aria-hidden
                    strokeWidth={ICON_STROKE_WIDTH}
                    className="absolute right-2.5 size-4 text-primary-ink"
                  />
                )}
              </li>
            ))}
          </ul>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export { Combobox };

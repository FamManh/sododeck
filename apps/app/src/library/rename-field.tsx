import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { CircleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

/**
 * Inline name editing for decks and folders (F2): Enter saves, Esc or leaving the field cancels.
 * `onSubmit` returns an error message to show under the field (focus stays), or `null` when done.
 */
export function RenameField({
  initial,
  label,
  onSubmit,
  onDone,
  className,
}: {
  initial: string;
  label: string;
  onSubmit: (name: string) => Promise<string | null>;
  onDone: () => void;
  className?: string;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  const submit = async () => {
    if (busy.current) return;
    if (value.trim() === initial.trim()) {
      onDone();
      return;
    }
    busy.current = true;
    const message = await onSubmit(value);
    busy.current = false;
    if (message === null) onDone();
    else {
      setError(message);
      input.current?.focus();
    }
  };

  return (
    <span className={cn('flex min-w-0 flex-col gap-1', className)}>
      <input
        ref={input}
        aria-label={label}
        aria-invalid={error === null ? undefined : true}
        aria-describedby={error === null ? undefined : errorId}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter') {
            event.preventDefault();
            void submit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            onDone();
          }
        }}
        onBlur={() => {
          if (!busy.current) onDone();
        }}
        onClick={(event) => {
          event.stopPropagation();
        }}
        className={cn(
          'h-8 w-full min-w-0 rounded-input border border-primary bg-surface px-2 text-body text-ink aria-invalid:border-clay-ink',
          focusRing,
        )}
      />
      {error !== null && (
        <span id={errorId} className="flex items-center gap-1 text-body-sm text-clay-ink">
          <CircleAlert aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5 shrink-0" />
          {error}
        </span>
      )}
    </span>
  );
}

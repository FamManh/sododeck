import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import { Braces } from 'lucide-react';
import type { KeyboardEvent } from 'react';

import type { CodeFormat } from '../../state/json-panel-prefs';

const CODE_FORMATS: readonly { id: CodeFormat; label: string }[] = [
  { id: 'json', label: 'JSON' },
  { id: 'dbml', label: 'DBML' },
  { id: 'sql', label: 'SQL' },
];

/** JSON | DBML | SQL tabs of the code panel header (046 contracts/code-panel-ui.md). */
export function CodeFormatTabs({
  format,
  onChange,
}: {
  format: CodeFormat;
  onChange: (format: CodeFormat) => void;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = CODE_FORMATS.findIndex((f) => f.id === format);
    const next = CODE_FORMATS[(index + step + CODE_FORMATS.length) % CODE_FORMATS.length];
    if (next === undefined) return;
    onChange(next.id);
    document.getElementById(`code-format-${next.id}`)?.focus();
  };
  return (
    <div className="flex items-center gap-2">
      <Braces aria-hidden className="size-4 text-ink-secondary" />
      <div role="tablist" aria-label="Code format" className="flex items-center gap-0.5">
        {CODE_FORMATS.map(({ id, label }) => {
          const selected = id === format;
          return (
            <button
              key={id}
              id={`code-format-${id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                onChange(id);
              }}
              onKeyDown={onKeyDown}
              className={cn(
                'rounded-button px-2.5 py-1 text-body-sm transition-colors',
                selected
                  ? 'bg-surface-2 font-medium text-ink'
                  : 'text-ink-secondary hover:text-ink',
                focusRing,
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

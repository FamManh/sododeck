import { validateValue } from '@sododeck/model';
import { Input } from '@sododeck/ui/components/input';
import { useId, useState, type KeyboardEvent } from 'react';

import { ControlError } from './control-error';
import { describedBy } from './described-by';
import type { ValueControlProps } from './types';

function linkOf(value: unknown): { url: string; label: string } {
  if (value !== null && typeof value === 'object' && 'url' in value) {
    const { url, label } = value as { url: unknown; label?: unknown };
    return {
      url: typeof url === 'string' ? url : '',
      label: typeof label === 'string' ? label : '',
    };
  }
  return { url: '', label: '' };
}

/**
 * Link: a `group` named by the field with "URL" and "Label" textboxes; commits on Enter or when
 * focus leaves the group. Only http, https and mailto addresses are stored; never fetched.
 */
export function LinkControl({ field, labelId, value, onCommit, descriptionId }: ValueControlProps) {
  const errorId = useId();
  const stored = linkOf(value);
  const [draft, setDraft] = useState<{ url: string; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = draft ?? stored;
  const commit = () => {
    if (draft === null) return;
    const url = draft.url.trim();
    const label = draft.label.trim();
    if (url === stored.url && label === stored.label) {
      setDraft(null);
      setError(null);
      return;
    }
    if (url === '') {
      setDraft(null);
      setError(null);
      onCommit(null);
      return;
    }
    const next = label === '' ? { url } : { url, label };
    const message = validateValue(field, next);
    setError(message);
    if (message === null) {
      setDraft(null);
      onCommit(next);
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape' && draft !== null) {
      event.preventDefault();
      event.stopPropagation();
      setDraft(null);
      setError(null);
    }
  };
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="flex min-w-0 flex-col gap-1"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) commit();
      }}
    >
      <Input
        aria-label="URL"
        placeholder="https://…"
        value={shown.url}
        aria-invalid={error !== null || undefined}
        aria-describedby={describedBy(descriptionId, error !== null && errorId)}
        onChange={(event) => {
          setDraft({ ...shown, url: event.target.value });
          setError(null);
        }}
        onKeyDown={onKeyDown}
        className="h-8"
      />
      <Input
        aria-label="Label"
        placeholder="Label (optional)"
        value={shown.label}
        onChange={(event) => {
          setDraft({ ...shown, label: event.target.value });
        }}
        onKeyDown={onKeyDown}
        className="h-8"
      />
      <ControlError id={errorId} message={error} />
    </div>
  );
}

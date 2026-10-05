import { Textarea } from '@sododeck/ui/components/textarea';
import { useEffect, useId, useRef } from 'react';

import { couldNotCopyText } from './clipboard';

/**
 * The hand-copy fallback of a failed report copy (062 R10, FR-017): the hint and a read-only text
 * area holding the JSON, focused with all of it selected so ⌘C / Ctrl+C copies it at once.
 */
export function CopyFallback({ text, label }: { text: string; label: string }) {
  const area = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const hintId = useId();
  useEffect(() => {
    area.current?.focus();
    area.current?.select();
  }, [text]);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-body-sm font-medium text-ink-secondary">
        {label}
      </label>
      <Textarea
        ref={area}
        id={id}
        readOnly
        value={text}
        rows={8}
        spellCheck={false}
        aria-describedby={hintId}
      />
      <p id={hintId} className="text-body-sm text-ink-secondary">
        {couldNotCopyText()}
      </p>
    </div>
  );
}

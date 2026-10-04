import { RadioGroupItem } from '@sododeck/ui/components/radio-group';
import { cn } from '@sododeck/ui/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { useId, type RefObject } from 'react';

import type { ExportFormat } from './types';

/**
 * One labelled group of the dialog's single "Format" radio group (045 research R18): "Schema" or
 * "Image and data". Arrow keys move across both groups, since they share one radio group.
 */
export function FormatGroup({
  label,
  formats,
  checked,
  checkedRef,
}: {
  label: string;
  formats: readonly { id: ExportFormat; label: string; subtitle: string; icon: LucideIcon }[];
  checked: ExportFormat;
  checkedRef: RefObject<HTMLButtonElement | null>;
}) {
  const heading = useId();
  return (
    <div role="group" aria-labelledby={heading} className="flex flex-col gap-2">
      <h3
        id={heading}
        className="px-1 text-micro font-medium tracking-[0.07em] text-ink-muted uppercase"
      >
        {label}
      </h3>
      {formats.map(({ id, label: name, subtitle, icon: Icon }) => (
        <RadioGroupItem
          key={id}
          ref={checked === id ? checkedRef : undefined}
          value={id}
          aria-label={name}
          className={cn(
            'rounded-row border p-3',
            checked === id ? 'border-primary bg-primary-soft' : 'border-border',
          )}
          label={
            <span className="flex items-center gap-2 font-medium">
              <Icon aria-hidden className="size-4 text-ink-secondary" />
              {name}
            </span>
          }
          description={subtitle}
        />
      ))}
    </div>
  );
}

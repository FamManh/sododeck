import type * as React from 'react';

import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';

/** Multi-line markdown field: mono 12.5/1.55, vertical resize (DESIGN.md textarea). */
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'min-h-24 w-full resize-y rounded-input border border-border bg-surface px-[11px] py-2 font-mono text-code-md text-ink transition-colors placeholder:text-ink-muted focus:border-primary disabled:cursor-not-allowed disabled:opacity-50',
        focusRing,
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };

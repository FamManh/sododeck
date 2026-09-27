import type * as React from 'react';

import { cn } from '@sododeck/ui/lib/utils';

/**
 * Editor side panel (DESIGN.md "Flat" tier): a Surface column whose sections are
 * separated by hairlines, each headed by an uppercase micro-label.
 */
function Panel({ className, ...props }: React.ComponentProps<'aside'>) {
  return (
    <aside
      data-slot="panel"
      className={cn('flex min-h-0 flex-col overflow-hidden bg-surface', className)}
      {...props}
    />
  );
}

function PanelHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="panel-header"
      className={cn(
        'flex h-11 shrink-0 items-center gap-2 border-b border-hairline px-4',
        className,
      )}
      {...props}
    />
  );
}

function PanelTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return (
    <h2
      data-slot="panel-title"
      className={cn('truncate text-title-sm text-ink', className)}
      {...props}
    />
  );
}

function PanelContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="panel-content"
      className={cn('min-h-0 flex-1 overflow-y-auto', className)}
      {...props}
    />
  );
}

function PanelSection({
  className,
  label,
  children,
  ...props
}: React.ComponentProps<'section'> & { label?: React.ReactNode }) {
  return (
    <section
      data-slot="panel-section"
      className={cn(
        'flex flex-col gap-2 border-b border-hairline px-4 py-3.5 last:border-b-0',
        className,
      )}
      {...props}
    >
      {label !== undefined && <h3 className="text-micro text-ink-muted uppercase">{label}</h3>}
      {children}
    </section>
  );
}

export { Panel, PanelContent, PanelHeader, PanelSection, PanelTitle };

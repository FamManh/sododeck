import { Panel, PanelContent, PanelHeader, PanelTitle } from '@sododeck/ui/components/panel';
import type { ReactNode } from 'react';

/** The inspector's panel with a flow, step or branch header (designs 42, 45, 46). */
export function InspectorFrame({
  icon,
  heading,
  subtitle,
  actions,
  children,
}: {
  icon: ReactNode;
  heading: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Panel aria-label="Inspector">
      <PanelHeader className="h-auto min-h-16 gap-3 py-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-card bg-primary-soft text-primary-ink">
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <PanelTitle title={heading}>{heading}</PanelTitle>
          <span className="truncate text-caption text-ink-secondary">{subtitle}</span>
        </div>
        {actions}
      </PanelHeader>
      <PanelContent>{children}</PanelContent>
    </Panel>
  );
}

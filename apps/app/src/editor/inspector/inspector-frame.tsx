import { Panel, PanelContent, PanelHeader, PanelTitle } from '@sododeck/ui/components/panel';
import type { ReactNode } from 'react';

import { DrawerCloseButton } from '../shell/drawer-close';

/**
 * The inspector's panel: an icon tile, the heading and subtitle, header actions (delete), and the
 * sections (designs 02, 10, 42, 45, 46, 49–51, 58). `plainIcon` shows the icon as is (a kind tile).
 */
export function InspectorFrame({
  icon,
  heading,
  subtitle,
  actions,
  plainIcon = false,
  children,
}: {
  icon: ReactNode;
  heading: string;
  subtitle: string;
  actions?: ReactNode;
  plainIcon?: boolean;
  children: ReactNode;
}) {
  return (
    <Panel aria-label="Inspector">
      <PanelHeader className="h-auto min-h-16 gap-3 py-3">
        {plainIcon ? (
          icon
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-card bg-primary-soft text-primary-ink">
            {icon}
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <PanelTitle title={heading}>{heading}</PanelTitle>
          <span className="truncate text-caption text-ink-secondary" title={subtitle}>
            {subtitle}
          </span>
        </div>
        {actions}
        <DrawerCloseButton />
      </PanelHeader>
      <PanelContent>{children}</PanelContent>
    </Panel>
  );
}

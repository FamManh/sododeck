import { Button } from '@sododeck/ui/components/button';
import { X } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';

/**
 * Tidy layout's progress next to the views control (011 FR-032, moved by 018 §g-46): after
 * 500 ms an indeterminate bar and "Cancel layout"; nothing otherwise. The run itself starts from
 * the current view's menu ("Tidy layout").
 */
export function TidyProgress({ onCancel }: { onCancel?: () => void }) {
  const status = useUiStore((s) => s.layoutRun.status);
  if (status !== 'slow' || onCancel === undefined) return null;
  return (
    <div className="flex items-center gap-2 rounded-button bg-surface-2 px-2.5 py-1">
      <div
        role="progressbar"
        aria-label="Tidying layout"
        className="relative h-1 w-20 overflow-hidden rounded-full bg-surface-3"
      >
        <span className="sd-progress-indeterminate absolute inset-y-0 w-1/3 rounded-full bg-primary" />
      </div>
      <Button variant="ghost" size="sm" onClick={onCancel}>
        <X />
        Cancel layout
      </Button>
    </div>
  );
}

/** What the current view's menu needs to offer Tidy layout. */
export interface TidyAction {
  /** Why it cannot run now (`useTidyBlock`), or null. */
  block: string | null;
  running: boolean;
  run: () => void;
}

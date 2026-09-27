import type { SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { Route, X } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import { exitFlow } from './flow-mode';
import { findFlow } from './session-path';

/** Top-bar chip "Flow mode · <flow>" with its exit button (007 FR-002, design 03). */
export function FlowModeChip({ deck }: { deck: SododeckFile }) {
  const flowId = useUiStore((s) => s.activeFlow?.flowId ?? null);
  const flow = findFlow(deck, flowId);
  if (flow === undefined) return null;
  const text = `Flow mode · ${flow.title}`;
  return (
    <div className="flex min-w-0 items-center gap-1 rounded-full bg-primary-soft py-1 pr-1 pl-3">
      <span role="status" className="flex min-w-0 items-center gap-2 text-body text-primary-ink">
        <Route aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4 shrink-0" />
        <span className="truncate" title={text}>
          {text}
        </span>
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Exit flow mode"
        className="rounded-full text-primary-ink"
        onClick={() => {
          exitFlow();
        }}
      >
        <X strokeWidth={ICON_STROKE_WIDTH} />
      </Button>
    </div>
  );
}

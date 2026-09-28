import type { SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { Route, X } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import { exitFlow } from './flow-mode';
import { findFlow } from './session-path';

/** Deck-island chip "Flow · <flow>" with its exit button (007 FR-002, design 03; 018 design 90). */
export function FlowModeChip({ deck }: { deck: SododeckFile }) {
  const flowId = useUiStore((s) => s.activeFlow?.flowId ?? null);
  const flow = findFlow(deck, flowId);
  if (flow === undefined) return null;
  const text = `Flow · ${flow.title}`;
  return (
    <div className="flex h-8 max-w-64 min-w-0 shrink items-center gap-1 rounded-full bg-primary-soft pr-0.5 pl-3">
      <span role="status" className="flex min-w-0 items-center gap-2 text-body text-primary-ink">
        <Route aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4 shrink-0" />
        <span className="truncate" title={text}>
          {text}
        </span>
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Exit flow ${flow.title}`}
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

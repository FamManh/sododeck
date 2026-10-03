/**
 * The Line style popover content (022 US1, frame 128): title, the "3 connectors" subtitle for a
 * multi-selection, and the shared controls. Hosted by the toolbar's `FieldPopover`, which gives it
 * the `dialog` role and name and returns focus to the "Line style" button on close.
 */
import type { Edge } from '@sododeck/schema';

import { LineStyleControls } from './line-style-controls';

export function LineStylePopover({ edges }: { edges: readonly Edge[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-body font-medium text-ink">Line style</h2>
        {edges.length > 1 ? (
          <p className="text-caption text-ink-secondary">
            {String(edges.length)} connectors · one change applies to all
          </p>
        ) : null}
      </div>
      <LineStyleControls edges={edges} />
    </div>
  );
}

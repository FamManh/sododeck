import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { CornerDownLeft, Table } from 'lucide-react';

import { tableCountText } from '../db/owner';
import type { DatabaseFace } from './deck-to-flow';

/**
 * A database card's bottom row (049): "12 tables inside", the deck's dialect chip and the Enter
 * hint. It takes the place of the generic "n inside" row, so the card keeps its height.
 */
export function DatabaseRow({ face }: { face: DatabaseFace }) {
  const count = tableCountText(face.count);
  return (
    <span
      role="img"
      aria-label={`${count}, ${face.dialect}, press Enter to open`}
      className="flex h-6 shrink-0 items-center gap-1.5 rounded-row bg-surface-2 px-2 text-caption text-ink-secondary"
    >
      <Table aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3" />
      <span className="flex-1 truncate">{count}</span>
      <span
        data-testid="dialect-chip"
        className="shrink-0 rounded-full border border-hairline bg-surface px-1.5 text-[10.5px] leading-4 font-medium text-ink-secondary"
      >
        {face.dialect}
      </span>
      <CornerDownLeft aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3" />
    </span>
  );
}

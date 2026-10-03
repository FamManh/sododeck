import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import type { NodeProps } from '@xyflow/react';
import { ChevronDown } from 'lucide-react';
import { memo } from 'react';

import type { ScopeLabelFlowNode } from './deck-to-flow';

/**
 * "Inside <name> · n" (034 R8): the drilled scope's label, drawn like an expanded group's label
 * pill (DESIGN.md Groups). Decorative: the breadcrumb names the level for assistive tech.
 */
export const ScopeLabelNode = memo(function ScopeLabelNode({
  data,
}: NodeProps<ScopeLabelFlowNode>) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none flex h-7 items-center gap-1.5 rounded-full border-[1.5px] border-border-strong bg-surface pr-1.5 pl-2.5 text-[12.5px] font-semibold whitespace-nowrap text-ink shadow-[0_2px_0_0_var(--color-border-strong)]"
    >
      <ChevronDown
        aria-hidden
        strokeWidth={ICON_STROKE_WIDTH}
        className="size-3.5 text-ink-secondary"
      />
      Inside {data.title}
      <span className="flex size-[18px] items-center justify-center rounded-full bg-ink text-[10.5px] leading-none font-bold text-surface">
        {data.count}
      </span>
    </div>
  );
});

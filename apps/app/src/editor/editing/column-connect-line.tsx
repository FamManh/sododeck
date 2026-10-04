import { ViewportPortal } from '@xyflow/react';

import { useUiStore } from '../../state/ui-store';
import { rowKey } from '../relationships/row-key';

/**
 * The relationship drag's feedback (042 R9): a dashed ghost line from the port to the pointer,
 * the target row's highlight and every port shown (one generated stylesheet, so no card
 * re-renders), and the type warning chip next to the target row.
 */
export function ColumnConnectLine() {
  const drag = useUiStore((s) => s.columnConnect);
  if (drag === null) return null;
  const target =
    drag.target === undefined
      ? null
      : `[data-row="${CSS.escape(rowKey(drag.target.tableId, drag.target.columnId))}"]`;
  const css = [
    '[data-canvas] .sd-row-port { opacity: 1; }',
    target === null
      ? ''
      : `[data-canvas] ${target} { background: var(--color-deck-orange-soft); box-shadow: inset 0 0 0 1.5px var(--color-deck-orange); }`,
  ].join('\n');
  const end = drag.target !== undefined && drag.targetAt !== undefined ? drag.targetAt : drag.point;
  return (
    <ViewportPortal>
      <style>{css}</style>
      <svg
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 overflow-visible"
        width={1}
        height={1}
        data-testid="column-connect-line"
      >
        <line
          x1={drag.from.x}
          y1={drag.from.y}
          x2={end.x}
          y2={end.y}
          stroke="var(--color-deck-orange)"
          strokeWidth={2}
          strokeDasharray="5 4"
          strokeLinecap="round"
        />
        <circle cx={drag.from.x} cy={drag.from.y} r={4} fill="var(--color-deck-orange)" />
      </svg>
      {drag.mismatch !== undefined && drag.targetAt !== undefined && (
        <span
          role="status"
          className="pointer-events-none absolute flex h-5 items-center rounded-full border border-amber-ink bg-amber-soft px-2 font-mono text-[11px] whitespace-nowrap text-amber-ink"
          style={{
            transform: `translate(${String(drag.targetAt.x + 10)}px, ${String(drag.targetAt.y)}px) translateY(-50%)`,
          }}
        >
          Types differ: {drag.mismatch}
        </span>
      )}
    </ViewportPortal>
  );
}

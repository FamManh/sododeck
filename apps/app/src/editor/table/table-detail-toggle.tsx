import type { DbDetail } from '@sododeck/schema';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';

import { useEditor } from '../../model/use-editor';
import { oneStep } from '../fields/one-step';
import { DETAIL_NAMES, nextDetail } from './table-text';

/**
 * The per-table detail toggle in the header's badge slot (frame 156 "collapse toggle"). One undo
 * step per press; a press never selects or drags the card.
 */
export function TableDetailToggle({
  nodeId,
  own,
  focused,
  textClass,
}: {
  nodeId: string;
  own: DbDetail | undefined;
  focused: boolean;
  textClass: string | null;
}) {
  const editor = useEditor();
  const current = own === undefined ? 'Use deck setting' : DETAIL_NAMES[own];
  const Icon = own === 'all' ? ChevronsDownUp : ChevronsUpDown;
  return (
    <button
      type="button"
      aria-label={`Detail: ${current}`}
      title={`Detail: ${current}`}
      tabIndex={focused ? 0 : -1}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
      }}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        const next = nextDetail(own);
        oneStep(editor, () => {
          editor.update('nodes', nodeId, { detail: next ?? null });
        });
      }}
      className={cn(
        'nodrag nopan inline-flex size-5 shrink-0 items-center justify-center rounded-[6px] hover:bg-surface-2',
        textClass ?? 'text-ink-secondary',
      )}
    >
      <Icon aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
    </button>
  );
}

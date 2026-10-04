import { cn } from '@sododeck/ui/lib/utils';

import { useEditor } from '../../model/use-editor';
import { oneStep } from '../fields/one-step';

/**
 * "Show all n columns" / "Show fewer" (048, frame 158): the dashed button under a long table's rows.
 * The choice is saved on the table (`expanded`, one undo step) and works on a locked table, since
 * it changes what is drawn, not the schema. A press never selects or drags the card.
 */
export function ShowAllButton({
  nodeId,
  label,
  expanded,
  tabIndex,
  withGap,
}: {
  nodeId: string;
  label: string;
  expanded: boolean;
  tabIndex: number;
  /** Rows sit above it: the 6 px gap `tableLayout` reserved. */
  withGap: boolean;
}) {
  const editor = useEditor();
  return (
    <button
      type="button"
      aria-expanded={expanded}
      tabIndex={tabIndex}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
      }}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        oneStep(editor, () => {
          editor.update('nodes', nodeId, { expanded: !expanded });
        });
      }}
      className={cn(
        'nodrag nopan flex h-6 shrink-0 cursor-pointer items-center justify-center rounded-row border-[1.5px] border-dashed border-border-strong text-[11.5px] font-medium text-ink-secondary hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
        withGap && 'mt-1.5',
      )}
    >
      {label}
    </button>
  );
}

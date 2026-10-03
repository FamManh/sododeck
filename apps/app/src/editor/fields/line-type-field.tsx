import type { Edge, EdgeShape } from '@sododeck/schema';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';

import { useEditor } from '../../model/use-editor';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import { applyLineType, LINE_TYPES, sharedLineShape } from './line-type';

/**
 * "Line type" radio group for one or several connections (029 R5): the checked option is the
 * shared effective shape, none when they differ. Picking writes all of them in one undo step.
 */
export function LineTypeField({ edges }: { edges: readonly Edge[] }) {
  const editor = useEditor();
  const editable = useUiStore((s) => !isFlowMode(s) && s.flowSession === null);
  const shared = sharedLineShape(edges);
  return (
    <SegmentedControl
      aria-label="Line type"
      value={shared ?? ''}
      disabled={!editable}
      onValueChange={(value) => {
        // Radix reports '' when the checked option is pressed again: nothing to change.
        if (value === '') return;
        applyLineType(
          editor,
          edges.map((edge) => edge.id),
          value as EdgeShape,
        );
      }}
      className="self-start"
    >
      {LINE_TYPES.map(({ value, label, icon: Icon }) => (
        <SegmentedControlItem key={value} value={value}>
          <Icon aria-hidden strokeWidth={ICON_STROKE_WIDTH} />
          {label}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}

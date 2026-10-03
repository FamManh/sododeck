import { effectiveFamily, hasTwoForms } from '@sododeck/model';
import type { Node } from '@sododeck/schema';
import { PanelSection } from '@sododeck/ui/components/panel';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import { useId } from 'react';

import { useEditor } from '../../model/use-editor';
import { showAs } from '../actions/shape-form-actions';

/**
 * "Show as" Card / Shape in the drawer (031 US3): only for decision, database and document. Each
 * pick is one undo step; description, fields and tags stay editable in both forms.
 */
export function ShowAsField({ node }: { node: Node }) {
  const editor = useEditor();
  const labelId = useId();
  if (!hasTwoForms(node.type)) return null;
  return (
    <PanelSection>
      <div className="flex items-center justify-between gap-3">
        <span id={labelId} className="text-body text-ink-secondary">
          Show as
        </span>
        <SegmentedControl
          aria-labelledby={labelId}
          value={effectiveFamily(node)}
          onValueChange={(value) => {
            if (value === 'card' || value === 'shape') showAs({ editor }, [node.id], value);
          }}
        >
          <SegmentedControlItem value="card">Card</SegmentedControlItem>
          <SegmentedControlItem value="shape">Shape</SegmentedControlItem>
        </SegmentedControl>
      </div>
    </PanelSection>
  );
}

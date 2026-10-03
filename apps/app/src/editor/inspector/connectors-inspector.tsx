import type { Edge } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { PanelSection } from '@sododeck/ui/components/panel';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { Spline, Trash2 } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import { LineStyleControls } from '../line-style/line-style-controls';
import { InspectorFrame } from './inspector-frame';

/**
 * Two or more connections selected, nothing else (029 R5): line style is the one thing they
 * share; everything else is edited one connection at a time.
 */
export function ConnectorsInspector({ edges }: { edges: readonly Edge[] }) {
  const heading = `${String(edges.length)} connectors`;
  return (
    <InspectorFrame
      icon={<Spline aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-5" />}
      heading={heading}
      subtitle="Select one connector to edit its details."
      actions={
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${heading}`}
          onClick={() => {
            useUiStore.getState().requestDelete({ nodes: [], edges: edges.map((e) => e.id) });
          }}
        >
          <Trash2 />
        </Button>
      }
    >
      <PanelSection label="Line">
        <LineStyleControls edges={edges} />
      </PanelSection>
    </InspectorFrame>
  );
}

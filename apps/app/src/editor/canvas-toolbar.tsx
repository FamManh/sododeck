import { Button } from '@sododeck/ui/components/button';
import { Tag } from 'lucide-react';

import { useUiStore } from '../state/ui-store';

/** Canvas header, top right (design 02/58): selection count and the Labels toggle. */
export function CanvasToolbar() {
  const count = useUiStore((s) => s.selection.nodes.length + s.selection.edges.length);
  const labelsOn = useUiStore((s) => s.labelsOn);
  const setLabelsOn = useUiStore((s) => s.setLabelsOn);

  return (
    <div className="flex items-center gap-2">
      {count >= 2 && (
        <span className="rounded-full bg-primary px-2.5 py-1 text-caption font-medium text-on-primary shadow-rest">
          {count} selected
        </span>
      )}
      <Button
        variant="toggle"
        pressed={labelsOn}
        className="shadow-rest"
        onClick={() => {
          setLabelsOn(!labelsOn);
        }}
      >
        <Tag />
        Labels
      </Button>
    </div>
  );
}

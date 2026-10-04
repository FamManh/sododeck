import type { Id, SododeckFile } from '@sododeck/schema';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { List } from 'lucide-react';

import { InspectorFrame } from '../inspector-frame';

/** The enum drawer (052): header now, the fields come with the enum story. */
export function EnumInspector({ deck, enumId }: { deck: SododeckFile; enumId: Id }) {
  const dbEnum = deck.enums?.find((e) => e.id === enumId);
  if (dbEnum === undefined) return null;
  const n = dbEnum.values.length;
  return (
    <InspectorFrame
      icon={<List aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-5" />}
      heading={dbEnum.name}
      subtitle={`Enum · ${String(n)} value${n === 1 ? '' : 's'}`}
    >
      {null}
    </InspectorFrame>
  );
}

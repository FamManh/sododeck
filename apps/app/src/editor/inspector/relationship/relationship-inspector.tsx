import type { Edge, SododeckFile } from '@sododeck/schema';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { Link2 } from 'lucide-react';

import { InspectorFrame } from '../inspector-frame';

function endLabel(deck: SododeckFile, nodeId: string, columns: readonly string[] | undefined) {
  const table = deck.nodes.find((n) => n.id === nodeId);
  const names = (columns ?? []).map((id) => table?.columns?.find((c) => c.id === id)?.name ?? id);
  const title = table?.title ?? nodeId;
  return names.length === 0 ? title : `${title}.${names.join(', ')}`;
}

/** The relationship drawer (052): header now, the fields come with the relationship story. */
export function RelationshipInspector({ deck, edge }: { deck: SododeckFile; edge: Edge }) {
  return (
    <InspectorFrame
      icon={<Link2 aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-5" />}
      heading={`${endLabel(deck, edge.from, edge.fromColumns)} → ${endLabel(deck, edge.to, edge.toColumns)}`}
      subtitle={edge.cardinality ?? 'Relationship'}
    >
      {null}
    </InspectorFrame>
  );
}

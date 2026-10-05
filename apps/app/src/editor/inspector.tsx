import type { SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { PanelSection } from '@sododeck/ui/components/panel';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { Layers, Trash2 } from 'lucide-react';

import { useUiStore } from '../state/ui-store';
import { isRelationship } from './relationships/relationship-ends';
import { FlowInspector } from './flows/flow-inspector';
import { BulkInspector } from './inspector/bulk-inspector';
import { DeckInspector } from './inspector/deck-inspector';
import { EdgeInspector } from './inspector/edge-inspector';
import { GroupInspector } from './inspector/group-inspector';
import { ConnectorsInspector } from './inspector/connectors-inspector';
import { InspectorFrame } from './inspector/inspector-frame';
import { NodeInspector } from './inspector/node-inspector';
import { RelationshipInspector } from './inspector/relationship/relationship-inspector';
import { ImageInspector } from './inspector/image-inspector';
import { StickyInspector } from './inspector/sticky-inspector';
import { TableInspector } from './inspector/table/table-inspector';

/**
 * The inspector (FR-001): the shown or recorded flow's inspectors (006), else one per canvas
 * selection: component, connection, several components (bulk), or the deck when nothing is
 * selected. Ids that no longer exist (removed here or in another tab) are ignored, so the
 * inspector falls back to the deck without an error.
 */
export function Inspector({ deck, onOpenRules }: { deck: SododeckFile; onOpenRules?: () => void }) {
  const session = useUiStore((s) => s.flowSession !== null);
  const flowId = useUiStore((s) => s.activeFlow?.flowId ?? null);
  // A flow removed in another tab falls back at once (006's flow sync then clears it).
  const inFlow = session || (flowId !== null && deck.flows.some((f) => f.id === flowId));
  return inFlow ? (
    <FlowInspector deck={deck} />
  ) : (
    <CanvasInspector deck={deck} onOpenRules={onOpenRules} />
  );
}

function CanvasInspector({ deck, onOpenRules }: { deck: SododeckFile; onOpenRules?: () => void }) {
  const selection = useUiStore((s) => s.selection);
  const nodes = deck.nodes.filter((n) => selection.nodes.includes(n.id));
  const edges = deck.edges.filter((e) => selection.edges.includes(e.id));
  const groups = deck.groups.filter((group) => selection.groups.includes(group.id));
  const stickies = deck.stickies.filter((sticky) => selection.stickies.includes(sticky.id));
  const [node] = nodes;
  const [edge] = edges;
  const [group] = groups;
  const [sticky] = stickies;
  const images = (deck.images ?? []).filter((image) => selection.images.includes(image.id));
  const [image] = images;

  if (nodes.length + edges.length + groups.length + stickies.length + images.length === 0) {
    return <DeckInspector deck={deck} onOpenRules={onOpenRules} />;
  }
  if (group !== undefined && groups.length === 1 && nodes.length === 0 && edges.length === 0) {
    return <GroupInspector deck={deck} group={group} />;
  }
  if (node?.type === 'db-table' && nodes.length === 1 && edges.length === 0) {
    return <TableInspector deck={deck} node={node} />;
  }
  if (node !== undefined && nodes.length === 1 && edges.length === 0) {
    return <NodeInspector deck={deck} node={node} />;
  }
  if (
    edge !== undefined &&
    edges.length === 1 &&
    nodes.length === 0 &&
    isRelationship(edge, (id) => deck.nodes.some((n) => n.id === id && n.type === 'db-table'))
  ) {
    return <RelationshipInspector deck={deck} edge={edge} />;
  }
  if (edge !== undefined && edges.length === 1 && nodes.length === 0) {
    return <EdgeInspector deck={deck} edge={edge} />;
  }
  if (sticky !== undefined && stickies.length === 1 && nodes.length === 0 && edges.length === 0) {
    return <StickyInspector deck={deck} sticky={sticky} />;
  }
  if (
    image !== undefined &&
    images.length === 1 &&
    nodes.length + edges.length + groups.length + stickies.length === 0
  ) {
    return <ImageInspector deck={deck} image={image} />;
  }
  if (nodes.length > 0) {
    return <BulkInspector deck={deck} nodes={nodes} edgeIds={edges.map((e) => e.id)} />;
  }
  if (edges.length > 1 && nodes.length + groups.length + stickies.length + images.length === 0) {
    return <ConnectorsInspector edges={edges} />;
  }
  const total = edges.length + groups.length + stickies.length + images.length;
  const heading = total === 1 ? '1 item selected' : `${String(total)} items selected`;
  const count = (n: number, noun: string) => `${String(n)} ${noun}${n === 1 ? '' : 's'}`;
  const subtitle = [
    edges.length > 0 ? count(edges.length, 'connection') : null,
    groups.length > 0 ? count(groups.length, 'group') : null,
    stickies.length > 0 ? count(stickies.length, 'note') : null,
    images.length > 0 ? count(images.length, 'image') : null,
  ]
    .filter((part) => part !== null)
    .join(' · ');
  return (
    <InspectorFrame
      icon={<Layers aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-5" />}
      heading={heading}
      subtitle={subtitle}
      actions={
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${heading.replace(' selected', '')}`}
          onClick={() => {
            // Every kind shown here, as the Delete key does (a group is ungrouped).
            useUiStore.getState().requestDelete(selection);
          }}
        >
          <Trash2 />
        </Button>
      }
    >
      <PanelSection>
        <p className="text-body-sm text-ink-secondary">
          Select one item to edit it, or a set of components to edit them together.
        </p>
      </PanelSection>
    </InspectorFrame>
  );
}

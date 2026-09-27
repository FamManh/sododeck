import type { SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { PanelSection } from '@sododeck/ui/components/panel';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { Layers, Trash2 } from 'lucide-react';

import { useUiStore } from '../state/ui-store';
import { FlowInspector } from './flows/flow-inspector';
import { BulkInspector } from './inspector/bulk-inspector';
import { DeckInspector } from './inspector/deck-inspector';
import { EdgeInspector } from './inspector/edge-inspector';
import { InspectorFrame } from './inspector/inspector-frame';
import { NodeInspector } from './inspector/node-inspector';

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
  const [node] = nodes;
  const [edge] = edges;

  if (nodes.length + edges.length === 0) {
    return <DeckInspector deck={deck} onOpenRules={onOpenRules} />;
  }
  if (node !== undefined && nodes.length === 1 && edges.length === 0) {
    return <NodeInspector deck={deck} node={node} />;
  }
  if (edge !== undefined && edges.length === 1 && nodes.length === 0) {
    return <EdgeInspector deck={deck} edge={edge} />;
  }
  if (nodes.length > 0) {
    return <BulkInspector deck={deck} nodes={nodes} edgeIds={edges.map((e) => e.id)} />;
  }
  return (
    <InspectorFrame
      icon={<Layers aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-5" />}
      heading={`${String(edges.length)} connections selected`}
      subtitle="Connections"
      actions={
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${String(edges.length)} connections`}
          onClick={() => {
            useUiStore.getState().requestDelete({ nodes: [], edges: edges.map((e) => e.id) });
          }}
        >
          <Trash2 />
        </Button>
      }
    >
      <PanelSection>
        <p className="text-body-sm text-ink-secondary">
          Select one connection to edit it, or a set of components to edit them together.
        </p>
      </PanelSection>
    </InspectorFrame>
  );
}

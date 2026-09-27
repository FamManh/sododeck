import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSection,
  PanelTitle,
} from '@sododeck/ui/components/panel';
import type { SododeckFile } from '@sododeck/schema';

import { useUiStore } from '../state/ui-store';

export function Inspector({ deck }: { deck: SododeckFile }) {
  const selectedId = useUiStore((state) => state.selectedId);
  const node = deck.nodes.find((candidate) => candidate.id === selectedId);

  return (
    <Panel aria-label="Inspector">
      <PanelHeader>
        <PanelTitle>{node ? node.title : 'Deck'}</PanelTitle>
      </PanelHeader>
      <PanelContent>
        {node ? (
          <>
            <PanelSection label="Id">
              <code className="font-mono text-code-sm">{node.id}</code>
            </PanelSection>
            <PanelSection label="Fields">
              <pre className="overflow-x-auto rounded-md bg-code p-2 font-mono text-code-sm">
                {JSON.stringify(node, null, 2)}
              </pre>
            </PanelSection>
          </>
        ) : (
          <PanelSection label="Summary">
            <dl className="grid grid-cols-2 gap-y-1 text-body-sm">
              <dt className="text-ink-muted">Nodes</dt>
              <dd>{deck.nodes.length}</dd>
              <dt className="text-ink-muted">Edges</dt>
              <dd>{deck.edges.length}</dd>
              <dt className="text-ink-muted">Flows</dt>
              <dd>{deck.flows.length}</dd>
            </dl>
            <p className="text-caption text-ink-muted">Select a node to inspect it.</p>
          </PanelSection>
        )}
      </PanelContent>
    </Panel>
  );
}

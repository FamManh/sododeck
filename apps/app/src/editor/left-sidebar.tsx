import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSection,
  PanelTitle,
} from '@sododeck/ui/components/panel';
import { cn } from '@sododeck/ui/lib/utils';
import type { SododeckFile } from '@sododeck/schema';

import { useUiStore } from '../state/ui-store';

export function LeftSidebar({ deck }: { deck: SododeckFile }) {
  const selectedId = useUiStore((state) => state.selectedId);
  const select = useUiStore((state) => state.select);

  return (
    <Panel aria-label="Outline">
      <PanelHeader>
        <PanelTitle>Outline</PanelTitle>
      </PanelHeader>
      <PanelContent>
        <PanelSection label={`Nodes · ${deck.nodes.length}`}>
          <ul className="-mx-2 flex flex-col">
            {deck.nodes.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  onClick={() => {
                    select(node.id);
                  }}
                  className={cn(
                    'flex h-8 w-full cursor-pointer items-center rounded-md px-2 text-left text-body-sm hover:bg-surface-2',
                    node.id === selectedId && 'bg-primary-soft text-primary-ink',
                  )}
                >
                  <span className="truncate">
                    {typeof node.title === 'string' ? node.title : node.id}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </PanelSection>
        <PanelSection label="Features">
          <p className="text-caption text-ink-muted">Flows and features arrive in Milestone 2.</p>
        </PanelSection>
      </PanelContent>
    </Panel>
  );
}

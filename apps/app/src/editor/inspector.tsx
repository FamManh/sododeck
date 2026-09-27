import { Button } from '@sododeck/ui/components/button';
import { KindTile } from '@sododeck/ui/components/kind-tile';
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSection,
  PanelTitle,
} from '@sododeck/ui/components/panel';
import type { SododeckFile } from '@sododeck/schema';
import { Layers, Spline, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { useEditor } from '../model/use-editor';
import { useUiStore } from '../state/ui-store';
import { DeckInspectorStorage } from './deck-inspector-storage';
import { kindLabel } from './kind-label';
import { FieldEdit } from './field-edit';

/** Minimal inspector (FR-026, design 02/10/11/58). Full fields arrive with 008. */
export function Inspector({ deck }: { deck: SododeckFile }) {
  const editor = useEditor();
  const selection = useUiStore((s) => s.selection);
  const requestDelete = useUiStore((s) => s.requestDelete);
  const count = selection.nodes.length + selection.edges.length;
  const node = count === 1 ? deck.nodes.find((n) => n.id === selection.nodes[0]) : undefined;
  const edge = count === 1 ? deck.edges.find((e) => e.id === selection.edges[0]) : undefined;
  const titleOf = (id: string) => deck.nodes.find((n) => n.id === id)?.title ?? id;

  let icon: ReactNode;
  let heading: string;
  let subtitle: string | undefined;
  let body: ReactNode;

  if (node) {
    icon = <KindTile kind={node.type} size={40} decorative />;
    heading = node.title;
    subtitle = kindLabel(node.type);
    body = (
      <PanelSection>
        <FieldEdit
          key={node.id}
          label="Title"
          value={node.title}
          onCommit={(title) => {
            editor.update('nodes', node.id, { title });
          }}
        />
      </PanelSection>
    );
  } else if (edge) {
    icon = <Spline aria-hidden className="size-5 text-ink-secondary" strokeWidth={1.5} />;
    heading = `${titleOf(edge.from)} → ${titleOf(edge.to)}`;
    subtitle = 'Connection';
    body = (
      <PanelSection>
        <FieldEdit
          key={edge.id}
          label="Label"
          value={edge.label ?? ''}
          allowEmpty
          placeholder="e.g. POST /orders"
          onCommit={(label) => {
            editor.update('edges', edge.id, { label: label === '' ? null : label });
          }}
        />
      </PanelSection>
    );
  } else if (count > 1) {
    icon = <Layers aria-hidden className="size-5 text-ink-secondary" strokeWidth={1.5} />;
    heading = `${String(count)} items selected`;
    body = null;
  } else {
    heading = deck.name ?? 'Untitled deck';
    subtitle = 'Deck';
    body = (
      <>
        <PanelSection>
          <FieldEdit
            label="Deck name"
            value={deck.name ?? ''}
            allowEmpty
            placeholder="Untitled deck"
            onCommit={(name) => {
              editor.updateMeta({ name: name === '' ? null : name });
            }}
          />
        </PanelSection>
        <PanelSection label="Summary">
          <dl className="grid grid-cols-2 gap-y-1 text-body-sm">
            <dt className="text-ink-muted">Components</dt>
            <dd>{deck.nodes.length}</dd>
            <dt className="text-ink-muted">Connections</dt>
            <dd>{deck.edges.length}</dd>
            <dt className="text-ink-muted">Groups</dt>
            <dd>{deck.groups.length}</dd>
            <dt className="text-ink-muted">Flows</dt>
            <dd>{deck.flows.length}</dd>
          </dl>
          <p className="text-caption text-ink-muted">Select a component to inspect it.</p>
        </PanelSection>
        <DeckInspectorStorage />
      </>
    );
  }

  return (
    <Panel aria-label="Inspector">
      <PanelHeader className="h-auto min-h-16 gap-3 py-3">
        {node
          ? icon
          : icon && (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-card bg-surface-2">
                {icon}
              </span>
            )}
        <div className="flex min-w-0 flex-1 flex-col">
          <PanelTitle>{heading}</PanelTitle>
          {subtitle && <span className="truncate text-caption text-ink-secondary">{subtitle}</span>}
        </div>
        {count > 0 && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete"
            onClick={() => {
              requestDelete(selection);
            }}
          >
            <Trash2 />
          </Button>
        )}
      </PanelHeader>
      <PanelContent>{body}</PanelContent>
    </Panel>
  );
}

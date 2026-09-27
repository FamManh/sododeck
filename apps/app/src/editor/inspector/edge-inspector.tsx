import type { Edge, SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { PanelSection } from '@sododeck/ui/components/panel';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { ArrowRight, Route, Spline, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { connectionCheck, REFUSAL_TEXT } from '../connection-rules';
import { FieldEdit } from '../field-edit';
import { DIRECTIONS, PROTOCOLS, type Direction } from '../fields/edge-choices';
import { FieldLabel } from '../fields/field-label';
import { LinksField } from '../fields/links-field';
import { MarkdownField } from '../fields/markdown-field';
import { oneStep } from '../fields/one-step';
import { openFlow } from '../flows/flow-mode';
import { OwnerField } from '../fields/owner-field';
import { PickField } from '../fields/pick-field';
import { TagsField } from '../fields/tags-field';
import { edgeUsage } from './derive';
import { InspectorFrame } from './inspector-frame';

type EdgePatch = Parameters<ReturnType<typeof useEditor>['update']>[2];

const NO_PROTOCOL = 'none';

/**
 * Connection inspector (FR-009, design 49): title (the label), from / to (reattach keeps the id;
 * self and duplicate connections are refused as when drawing), protocol, description, owner,
 * direction, tags, links, and the flow steps that use it. Shows the same values as the popover.
 */
export function EdgeInspector({ deck, edge }: { deck: SododeckFile; edge: Edge }) {
  const editor = useEditor();
  const [refusal, setRefusal] = useState<string | undefined>(undefined);
  const write = (patch: EdgePatch) => {
    editor.update('edges', edge.id, patch);
  };
  const writeOnce = (patch: EdgePatch) => {
    oneStep(editor, () => {
      write(patch);
    });
  };
  const text = (value: string) => (value === '' ? null : value);
  const titleOf = (id: string) => deck.nodes.find((n) => n.id === id)?.title ?? id;
  const nodeOptions = deck.nodes.map((n) => ({ value: n.id, label: n.title }));
  const uses = edgeUsage(deck, edge.id);

  const reattach = (from: string, to: string) => {
    const check = connectionCheck(deck, from, to, edge.id);
    if (check !== 'ok') {
      setRefusal(REFUSAL_TEXT[check]);
      useUiStore.getState().announce(REFUSAL_TEXT[check]);
      return;
    }
    setRefusal(undefined);
    writeOnce({ from, to });
  };

  return (
    <InspectorFrame
      icon={<Spline aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-5" />}
      heading={`${titleOf(edge.from)} → ${titleOf(edge.to)}`}
      subtitle={`Connection · ${edge.id}`}
      actions={
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete connection"
          onClick={() => {
            useUiStore.getState().requestDelete({ nodes: [], edges: [edge.id] });
          }}
        >
          <Trash2 />
        </Button>
      }
    >
      <div key={edge.id} className="contents">
        <PanelSection>
          <FieldEdit
            label="Title"
            value={edge.label ?? ''}
            allowEmpty
            placeholder="e.g. POST /orders"
            onCommit={(label) => {
              write({ label: text(label) });
            }}
          />
        </PanelSection>
        <PanelSection className="grid grid-cols-2 gap-3">
          <PickField
            label="From"
            listLabel="Components"
            value={edge.from}
            options={nodeOptions}
            onPick={(from) => {
              reattach(from, edge.to);
            }}
          />
          <PickField
            label="To"
            listLabel="Components"
            value={edge.to}
            options={nodeOptions}
            onPick={(to) => {
              reattach(edge.from, to);
            }}
          />
          {refusal !== undefined && (
            <p role="alert" className="col-span-2 text-caption text-clay-ink">
              {refusal}
            </p>
          )}
        </PanelSection>
        <PanelSection>
          <FieldLabel id={`${edge.id}-protocol`}>Protocol</FieldLabel>
          <SegmentedControl
            aria-labelledby={`${edge.id}-protocol`}
            value={edge.protocol ?? NO_PROTOCOL}
            onValueChange={(value) => {
              writeOnce({
                protocol: value === NO_PROTOCOL ? null : (value as NonNullable<Edge['protocol']>),
              });
            }}
            className="h-auto flex-wrap"
          >
            {PROTOCOLS.map((p) => (
              <SegmentedControlItem key={p.value} value={p.value} className="h-7 px-2">
                {p.label}
              </SegmentedControlItem>
            ))}
            <SegmentedControlItem value={NO_PROTOCOL} className="h-7 px-2">
              Not set
            </SegmentedControlItem>
          </SegmentedControl>
        </PanelSection>
        <PanelSection>
          <MarkdownField
            modeKey={`edges:${edge.id}`}
            value={edge.description ?? ''}
            placeholder="What goes over this connection? Markdown supported."
            onCommit={(description) => {
              write({ description: text(description) });
            }}
          />
        </PanelSection>
        <PanelSection>
          <OwnerField
            deck={deck}
            value={edge.owner ?? ''}
            onCommit={(owner) => {
              write({ owner: text(owner) });
            }}
          />
        </PanelSection>
        <PanelSection>
          <FieldLabel id={`${edge.id}-direction`}>Direction</FieldLabel>
          <SegmentedControl
            aria-labelledby={`${edge.id}-direction`}
            value={edge.direction ?? 'forward'}
            onValueChange={(value) => {
              writeOnce({ direction: value as Direction });
            }}
            className="self-start"
          >
            {DIRECTIONS.map(({ value, label, Icon }) => (
              <SegmentedControlItem key={value} value={value}>
                <Icon aria-hidden strokeWidth={ICON_STROKE_WIDTH} />
                {label}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </PanelSection>
        <PanelSection>
          <TagsField
            deck={deck}
            value={edge.tags}
            onCommit={(tags) => {
              writeOnce({ tags });
            }}
          />
        </PanelSection>
        <PanelSection>
          <LinksField
            value={edge.links}
            onCommit={(links) => {
              writeOnce({ links });
            }}
          />
        </PanelSection>
        <PanelSection label="Used in flows">
          {uses.length === 0 ? (
            <p className="text-body-sm text-ink-secondary">Not used in any flow</p>
          ) : (
            <ul aria-label="Used in flows" className="flex flex-col gap-1.5">
              {uses.map((u) => (
                <li key={u.stepId}>
                  <button
                    type="button"
                    onClick={() => {
                      openFlow(editor, u.flowId, u.stepId);
                    }}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2 rounded-card bg-surface-2 px-3 py-2 text-left hover:bg-surface-3',
                      focusRing,
                    )}
                  >
                    <Route
                      aria-hidden
                      strokeWidth={ICON_STROKE_WIDTH}
                      className="size-4 shrink-0"
                    />
                    <span className="min-w-0 flex-1 truncate text-body">
                      {u.flowTitle} · Step {u.number}
                    </span>
                    <ArrowRight aria-hidden className="size-4 shrink-0 text-ink-secondary" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PanelSection>
      </div>
    </InspectorFrame>
  );
}

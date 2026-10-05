import { endpointTitle, stickyCanvasPosition, stickyLabel } from '@sododeck/model';
import type { Id, SododeckFile, Sticky } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { Combobox } from '@sododeck/ui/components/combobox';
import { PanelSection } from '@sododeck/ui/components/panel';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import { Switch } from '@sododeck/ui/components/switch';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { Pin, PinOff, StickyNote, Trash2, TriangleAlert } from 'lucide-react';
import { useId, useState } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { FieldLabel } from '../fields/field-label';
import { MarkdownField } from '../fields/markdown-field';
import { oneStep } from '../fields/one-step';
import { CardTagsField } from '../tags/card-tags-field';
import { InspectorFrame } from './inspector-frame';
import { notesAreReadOnly } from '../stickies/sticky-actions';
import { StickyFormatFields } from './sticky-format-fields';

function edgeTitle(deck: SododeckFile, id: Id): string | null {
  const edge = deck.edges.find((entry) => entry.id === id);
  if (edge === undefined) return null;
  const from = endpointTitle(deck, edge.from);
  const to = endpointTitle(deck, edge.to);
  return `${from} → ${to}`;
}

function stickyAnchorLabel(deck: SododeckFile, anchor: Id): string | null {
  const node = deck.nodes.find((entry) => entry.id === anchor);
  if (node !== undefined) return `node ${node.title}`;
  const edge = edgeTitle(deck, anchor);
  if (edge !== null) return `connection ${edge}`;
  const group = deck.groups.find((entry) => entry.id === anchor);
  if (group !== undefined) return `group ${group.title}`;
  const view = deck.views.find((entry) => entry.id === anchor);
  if (view !== undefined) return `view ${view.title}`;
  const feature = deck.features.find((entry) => entry.id === anchor);
  if (feature !== undefined) return `feature ${feature.title}`;
  const flow = deck.flows.find((entry) => entry.id === anchor);
  if (flow !== undefined) return `flow ${flow.title}`;
  for (const entry of deck.flows) {
    const index = entry.steps.findIndex((step) => step.id === anchor);
    if (index !== -1) return `step ${String(index + 1)} · ${entry.title}`;
  }
  const rule = deck.rules[anchor];
  if (rule !== undefined) return `rule ${rule.title}`;
  return null;
}

function stickySubtitle(deck: SododeckFile, sticky: Sticky): string {
  const placement = stickyCanvasPosition(deck, sticky);
  switch (placement.status) {
    case 'free':
      return 'Note · free';
    case 'pinned': {
      const title =
        deck.nodes.find((node) => node.id === placement.pinnedTo)?.title ?? placement.pinnedTo;
      return `Note · pinned to ${title}`;
    }
    case 'foreign': {
      const label = stickyAnchorLabel(deck, placement.anchor);
      return label === null ? 'Note · pinned' : `Note · pinned to ${label}`;
    }
    case 'missing':
      return 'Note · pinned object is missing';
  }
}

export function StickyInspector({ deck, sticky }: { deck: SododeckFile; sticky: Sticky }) {
  const editor = useEditor();
  const readOnly = notesAreReadOnly();
  const announce = useUiStore((state) => state.announce);
  const placement = stickyCanvasPosition(deck, sticky);
  const heading = stickyLabel(sticky.text) ?? 'Note';
  const pinnedOptions = deck.nodes.map((node) => ({ value: node.id, label: node.title }));
  const [anchorMode, setAnchorMode] = useState<'free' | 'pinned'>(
    placement.status === 'pinned' ? 'pinned' : 'free',
  );
  const anchorId = useId();
  const displayId = useId();
  const switchId = useId();

  return (
    <InspectorFrame
      icon={<StickyNote aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-5" />}
      heading={heading}
      subtitle={stickySubtitle(deck, sticky)}
      actions={
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete note"
          disabled={readOnly}
          onClick={() => {
            useUiStore.getState().requestDelete({ stickies: [sticky.id] });
          }}
        >
          <Trash2 />
        </Button>
      }
    >
      <div key={sticky.id} className="contents">
        <PanelSection>
          <MarkdownField
            modeKey={`stickies:${sticky.id}`}
            label="Note text"
            value={sticky.text}
            placeholder="Add a note in Markdown."
            disabled={readOnly}
            emptyPreviewText="Nothing to preview."
            onCommit={(text) => {
              editor.update('stickies', sticky.id, { text });
            }}
          />
        </PanelSection>
        <PanelSection>
          <FieldLabel id={anchorId}>Anchor</FieldLabel>
          {placement.status === 'foreign' ? (
            <div className="flex items-start justify-between gap-3">
              <p className="flex min-w-0 items-center gap-2 text-body-sm text-ink-secondary">
                <Pin aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4 shrink-0" />
                <span>{`Pinned to ${stickyAnchorLabel(deck, placement.anchor) ?? placement.anchor}`}</span>
              </p>
              <Button
                variant="ghost"
                disabled={readOnly}
                onClick={() => {
                  editor.unpinSticky(sticky.id);
                  announce('Note unpinned');
                }}
              >
                <PinOff />
                Unpin
              </Button>
            </div>
          ) : placement.status === 'missing' ? (
            <div className="flex items-start justify-between gap-3">
              <p className="flex min-w-0 items-center gap-2 text-body-sm text-ink-secondary">
                <TriangleAlert
                  aria-hidden
                  strokeWidth={ICON_STROKE_WIDTH}
                  className="size-4 shrink-0"
                />
                <span>Pinned object is missing</span>
              </p>
              <Button
                variant="ghost"
                disabled={readOnly}
                onClick={() => {
                  editor.unpinSticky(sticky.id);
                  announce('Note unpinned');
                }}
              >
                <PinOff />
                Unpin
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <SegmentedControl
                aria-labelledby={anchorId}
                value={anchorMode}
                disabled={readOnly}
                onValueChange={(value) => {
                  const next = value as 'free' | 'pinned';
                  setAnchorMode(next);
                  if (next === 'free' && placement.status === 'pinned') {
                    editor.unpinSticky(sticky.id);
                    announce('Note unpinned');
                  }
                }}
                className="self-start"
              >
                <SegmentedControlItem value="free">Free</SegmentedControlItem>
                <SegmentedControlItem value="pinned">Pinned to node</SegmentedControlItem>
              </SegmentedControl>
              {anchorMode === 'pinned' && (
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor={`${sticky.id}-anchor-node`}>Pinned to</FieldLabel>
                  <Combobox
                    id={`${sticky.id}-anchor-node`}
                    mode="pick"
                    label="Pinned to"
                    listLabel="Components"
                    value={placement.status === 'pinned' ? placement.pinnedTo : ''}
                    options={pinnedOptions}
                    placeholder="Choose a component"
                    disabled={readOnly}
                    onValueChange={(nodeId) => {
                      if (nodeId === '') return;
                      editor.pinSticky(sticky.id, nodeId);
                      const title = deck.nodes.find((node) => node.id === nodeId)?.title ?? nodeId;
                      announce(`Note pinned to ${title}`);
                    }}
                  />
                  <span className="text-caption text-ink-secondary">
                    Moves with the node. Unpin keeps it where it is.
                  </span>
                </div>
              )}
            </div>
          )}
        </PanelSection>
        <PanelSection>
          <FieldLabel id={displayId}>Display</FieldLabel>
          <SegmentedControl
            aria-labelledby={displayId}
            value={sticky.collapsed === true ? 'collapsed' : 'expanded'}
            disabled={readOnly}
            onValueChange={(value) => {
              editor.update('stickies', sticky.id, {
                collapsed: value === 'collapsed' ? true : null,
              });
              announce(value === 'collapsed' ? 'Note collapsed' : 'Note expanded');
            }}
            className="self-start"
          >
            <SegmentedControlItem value="expanded">Expanded</SegmentedControlItem>
            <SegmentedControlItem value="collapsed">Collapsed</SegmentedControlItem>
          </SegmentedControl>
        </PanelSection>
        <StickyFormatFields sticky={sticky} disabled={readOnly} />
        <PanelSection>
          <CardTagsField
            stickyId={sticky.id}
            tags={sticky.tags}
            onCommit={(tags) => {
              oneStep(editor, () => {
                editor.setStickyTags(sticky.id, tags ?? []);
              });
            }}
          />
        </PanelSection>
        <PanelSection>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <label htmlFor={switchId} className="text-body text-ink">
                Stay visible during flows
              </label>
              <span id={`${switchId}-description`} className="text-caption text-ink-secondary">
                Off: dims to 35% unless its node is on the current step
              </span>
            </div>
            <Switch
              id={switchId}
              checked={sticky.showInFlows === true}
              disabled={readOnly}
              aria-describedby={`${switchId}-description`}
              aria-label="Stay visible during flows"
              onCheckedChange={(checked) => {
                editor.update('stickies', sticky.id, { showInFlows: checked ? true : null });
              }}
            />
          </div>
        </PanelSection>
      </div>
    </InspectorFrame>
  );
}

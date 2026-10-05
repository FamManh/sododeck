import { endpointTitle, isLocked } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { Input } from '@sododeck/ui/components/input';
import { Popover, PopoverAnchor, PopoverContent } from '@sododeck/ui/components/popover';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sododeck/ui/components/select';
import { Spline, Trash2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { useEditor } from '../model/use-editor';
import { useUiStore } from '../state/ui-store';
import { anchorRect, focusCanvas } from './canvas-actions';
import { DIRECTIONS, PROTOCOLS, type Direction } from './fields/edge-choices';
import { LOCKED_HINT } from './lock';

type Edge = SododeckFile['edges'][number];

const NO_PROTOCOL = 'none';

/** Inline editor for a connection: label, protocol, direction (FR-011, design 57). */
export function EdgePopover({ deck }: { deck: SododeckFile }) {
  const popover = useUiStore((s) => s.popover);
  const edgeId = popover?.kind === 'edge' ? popover.edgeId : null;
  const edge = edgeId === null ? undefined : deck.edges.find((e) => e.id === edgeId);
  if (!edge) return null;
  // Keyed by id: a different edge starts with a fresh label draft.
  return <EdgePopoverContent key={edge.id} deck={deck} edge={edge} />;
}

function EdgePopoverContent({ deck, edge }: { deck: SododeckFile; edge: Edge }) {
  const editor = useEditor();
  const closePopover = useUiStore((s) => s.closePopover);
  const requestDelete = useUiStore((s) => s.requestDelete);
  // The model refuses writes on a locked connector (053): the fields are read-only instead.
  const locked = isLocked(edge);
  const [draft, setDraft] = useState(edge.label ?? '');
  const labelId = useId();
  const protocolId = useId();
  const directionId = useId();
  const virtualRef = useRef({ getBoundingClientRect: () => anchorRect(edge.id) });

  // Either end may be a group (050 R6).
  const title = (id: string) => endpointTitle(deck, id);

  /** One update, only when the label really changed; an empty label clears the field. */
  const commitLabel = () => {
    const next = draft.trim();
    if (locked || next === (edge.label ?? '')) return;
    editor.update('edges', edge.id, { label: next === '' ? null : next });
  };

  const close = () => {
    commitLabel();
    closePopover();
  };

  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <PopoverAnchor virtualRef={virtualRef} />
      <PopoverContent
        aria-label="Connection"
        side="bottom"
        align="center"
        className="w-80"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById(labelId)?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          focusCanvas();
        }}
      >
        <div className="flex items-start gap-2.5">
          <Spline aria-hidden className="mt-0.5 size-4 text-ink-secondary" strokeWidth={1.5} />
          <div className="flex min-w-0 flex-col">
            <span className="text-title-sm">Connection</span>
            <span className="truncate text-caption text-ink-secondary">
              {title(edge.from)} → {title(edge.to)}
            </span>
          </div>
        </div>

        {locked && (
          <p role="note" className="text-caption text-ink-secondary">
            {LOCKED_HINT}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor={labelId} className="text-micro text-ink-muted uppercase">
            Label
          </label>
          <Input
            id={labelId}
            value={draft}
            disabled={locked}
            placeholder="e.g. POST /orders"
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onBlur={commitLabel}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                close();
              }
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span id={protocolId} className="text-micro text-ink-muted uppercase">
            Protocol
          </span>
          <Select
            value={edge.protocol ?? NO_PROTOCOL}
            disabled={locked}
            onValueChange={(value) => {
              editor.update('edges', edge.id, {
                protocol: value === NO_PROTOCOL ? null : (value as NonNullable<Edge['protocol']>),
              });
            }}
          >
            <SelectTrigger aria-labelledby={protocolId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PROTOCOL}>Not set</SelectItem>
              {PROTOCOLS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span id={directionId} className="text-micro text-ink-muted uppercase">
            Direction
          </span>
          <SegmentedControl
            aria-labelledby={directionId}
            value={edge.direction ?? 'forward'}
            disabled={locked}
            onValueChange={(value) => {
              editor.update('edges', edge.id, {
                direction: value as Direction,
              });
            }}
          >
            {DIRECTIONS.map(({ value, label, Icon }) => (
              <SegmentedControlItem key={value} value={value}>
                <Icon aria-hidden strokeWidth={1.5} />
                {label}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-clay-ink hover:text-clay-ink"
            onClick={() => {
              closePopover();
              requestDelete({ nodes: [], edges: [edge.id] });
            }}
          >
            <Trash2 />
            Delete
          </Button>
          <Button variant="primary" size="sm" onClick={close}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

import type { SododeckFile } from '@sododeck/schema';
import { Popover, PopoverAnchor, PopoverContent } from '@sododeck/ui/components/popover';
import { useId, useMemo, useRef, useState } from 'react';

import { useUiStore } from '../state/ui-store';
import { anchorRect, focusCanvas } from './canvas-actions';
import type { Bundle, BundleResult } from './bundles';
import { COLLAPSED_NODE_PREFIX } from './deck-to-flow';
import { scopeOf, visibleGraph } from './visible-graph';
import { useEditor } from '../model/use-editor';
import { setGroupCollapsed, useCollapsed } from './views/use-current-view';

const directionLabel = (direction: SododeckFile['edges'][number]['direction']) =>
  direction === 'both' ? 'both' : direction === 'none' ? 'none' : 'forward';

type PopoverEdge = ReturnType<typeof visibleGraph>['merged'][number] & { bundle?: Bundle };

export function MergedEdgePopover({
  deck,
  bundles,
}: {
  deck: SododeckFile;
  /** The canvas's bundles (034): a `bundle:` id opens a list of its connectors. */
  bundles?: BundleResult | undefined;
}) {
  const popover = useUiStore((state) => state.popover);
  const drill = useUiStore((state) => state.drill);
  const collapsed = useCollapsed();
  const mergedId = popover?.kind === 'merged' ? popover.edgeId : null;
  const graph = useMemo(
    () => visibleGraph(deck, scopeOf(drill), collapsed),
    [deck, drill, collapsed],
  );
  const bundle = bundles?.bundles.find((entry) => entry.id === mergedId);
  const merged: PopoverEdge | undefined =
    bundle !== undefined
      ? {
          id: bundle.id,
          a: bundle.a,
          b: bundle.b,
          edgeIds: bundle.edgeIds,
          direction: bundle.direction,
          bundle,
        }
      : mergedId === null
        ? undefined
        : graph.merged.find((edge) => edge.id === mergedId);
  if (merged === undefined) return null;
  return <MergedEdgePopoverContent key={merged.id} deck={deck} merged={merged} />;
}

function MergedEdgePopoverContent({ deck, merged }: { deck: SododeckFile; merged: PopoverEdge }) {
  const listId = useId();
  const closePopover = useUiStore((state) => state.closePopover);
  const editor = useEditor();
  const select = useUiStore((state) => state.select);
  const focusEdge = useUiStore((state) => state.focusEdge);
  const toggleFan = useUiStore((state) => state.toggleBundleFan);
  const requestDelete = useUiStore((state) => state.requestDelete);
  const virtualRef = useRef({ getBoundingClientRect: () => anchorRect(merged.id) });
  const [active, setActive] = useState(0);
  const rows = merged.edgeIds
    .map((edgeId) => deck.edges.find((edge) => edge.id === edgeId))
    .filter((edge): edge is SododeckFile['edges'][number] => edge !== undefined);

  const titleOf = (id: string) =>
    id.startsWith(COLLAPSED_NODE_PREFIX)
      ? (deck.groups.find((group) => group.id === id.slice(COLLAPSED_NODE_PREFIX.length))?.title ??
        id)
      : (deck.nodes.find((node) => node.id === id || `port:${node.id}` === id)?.title ?? id);
  const ends = [merged.a, merged.b]
    .filter((id) => id.startsWith(COLLAPSED_NODE_PREFIX))
    .map((id) => id.slice(COLLAPSED_NODE_PREFIX.length));

  const activate = (edgeId: string) => {
    for (const groupId of ends) setGroupCollapsed(editor, groupId, false);
    select({ edges: [edgeId] });
    focusEdge(edgeId);
    closePopover();
    globalThis.setTimeout(() => {
      if (typeof document !== 'undefined') focusCanvas();
    }, 0);
  };

  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) closePopover();
      }}
    >
      <PopoverAnchor virtualRef={virtualRef} />
      <PopoverContent
        aria-label={`Connections between ${titleOf(merged.a)} and ${titleOf(merged.b)}`}
        side="bottom"
        align="center"
        className="w-96"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          focusCanvas();
        }}
        onKeyDown={(event) => {
          // A bundle's rows are plain buttons: Tab and Enter work natively.
          if (rows.length === 0 || merged.bundle !== undefined) return;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((current) => (current + 1) % rows.length);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((current) => (current - 1 + rows.length) % rows.length);
          } else if (event.key === 'Enter') {
            event.preventDefault();
            const row = rows[active];
            if (row !== undefined) activate(row.id);
          }
        }}
      >
        <div className="flex flex-col gap-3">
          <div className="text-title-sm">
            Connections between {titleOf(merged.a)} and {titleOf(merged.b)}
          </div>
          {merged.bundle !== undefined && (
            <button
              type="button"
              className="self-start rounded-row border border-border px-2 py-1 text-body-sm hover:bg-surface-2"
              onClick={() => {
                toggleFan(merged.id);
              }}
            >
              {merged.bundle.fanned ? 'Fold' : 'Fan out'}
            </button>
          )}
          {merged.bundle !== undefined ? (
            <ul aria-label="Bundled connections" className="flex flex-col gap-1">
              {rows.map((row) => {
                const name =
                  row.label === undefined || row.label === ''
                    ? `${titleOf(row.from)} → ${titleOf(row.to)}`
                    : row.label;
                return (
                  <li key={row.id} className="flex items-center gap-2 px-2 py-1 text-body-sm">
                    <span className="flex-1">{name}</span>
                    <span className="text-caption text-ink-secondary">
                      {directionLabel(row.direction)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Select ${name}`}
                      className="rounded-row px-1.5 py-0.5 hover:bg-surface-2"
                      onClick={() => {
                        activate(row.id);
                      }}
                    >
                      Select
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${name}`}
                      className="rounded-row px-1.5 py-0.5 text-clay-ink hover:bg-surface-2"
                      onClick={() => {
                        closePopover();
                        requestDelete({ edges: [row.id] });
                      }}
                    >
                      Delete
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul
              role="listbox"
              id={listId}
              aria-label="Merged connections"
              className="flex flex-col gap-1"
            >
              {rows.map((row, index) => (
                <li key={row.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === active}
                    className="flex w-full items-center justify-between rounded-row px-2 py-1.5 text-left text-body-sm hover:bg-surface-2 aria-selected:bg-primary-soft aria-selected:text-primary-ink"
                    onClick={() => {
                      activate(row.id);
                    }}
                    onMouseEnter={() => {
                      setActive(index);
                    }}
                  >
                    <span>
                      {row.label === undefined || row.label === ''
                        ? `${titleOf(row.from)} → ${titleOf(row.to)}`
                        : row.label}
                    </span>
                    <span className="text-caption text-ink-secondary">
                      {directionLabel(row.direction)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

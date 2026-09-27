import { KindTile } from '@sododeck/ui/components/kind-tile';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { Handle, Position, useConnection, type NodeProps } from '@xyflow/react';
import { Ban, Plus, Table } from 'lucide-react';
import { memo, useEffect } from 'react';

import { useEditor } from '../model/use-editor';
import { readDeck } from '../model/use-deck-snapshot';
import { useUiStore } from '../state/ui-store';
import { connectionCheck, REFUSAL_TEXT, type ConnectionCheck } from './connection-rules';
import { NODE_SIZE, type DeckFlowNode } from './deck-to-flow';
import { kindLabel } from './kind-label';

const SIDES = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
] as const;

/**
 * This node's role in a connection being drawn: `source`, `target:<fromId>` while hovered as a
 * drop target, or null. One primitive per node, so a moving pointer re-renders at most two nodes.
 */
function useConnectionRole(id: string): string | null {
  return useConnection((c) => {
    if (!c.inProgress) return null;
    // Hovering the source's own handle is the self case, shown on the source itself.
    if (c.toNode?.id === id) return `target:${c.fromNode.id}`;
    return c.fromNode.id === id ? 'source' : null;
  });
}

/** Canvas node, 164×50 (DESIGN.md "node", design 02 and 53–55). */
export const DeckNode = memo(function DeckNode({ id, data, selected }: NodeProps<DeckFlowNode>) {
  const editor = useEditor();
  const openConnectPopover = useUiStore((s) => s.openConnectPopover);
  const announce = useUiStore((s) => s.announce);
  const connecting = useConnection((c) => c.inProgress);
  const role = useConnectionRole(id);

  let target: ConnectionCheck | null = null;
  if (role?.startsWith('target:')) {
    target = connectionCheck(readDeck(editor.doc), role.slice('target:'.length), id);
  }
  const refusal = target === null || target === 'ok' ? null : REFUSAL_TEXT[target];

  useEffect(() => {
    if (refusal) announce(refusal);
  }, [refusal, announce]);

  const name = `${kindLabel(data.kind)}: ${data.title}`;
  const tabIndex = data.focused ? 0 : -1;

  return (
    <div
      data-testid="deck-node"
      data-node-id={id}
      role="group"
      aria-roledescription="component"
      aria-label={name}
      aria-selected={selected}
      aria-description={selected ? 'Selected' : undefined}
      tabIndex={tabIndex}
      title={data.title}
      style={NODE_SIZE}
      className={cn(
        'group/node relative flex items-center gap-[9px] rounded-node border border-border bg-surface px-2.5 shadow-rest',
        focusRing,
        // Selected: border + halo + ring (DESIGN.md), so it is never color-only.
        selected && 'border-primary shadow-selection ring-1 ring-primary',
        target === 'ok' && 'outline-2 outline-offset-4 outline-primary outline-dashed',
        refusal && 'outline-2 outline-offset-4 outline-clay-ink outline-dashed',
      )}
    >
      <KindTile kind={data.kind} size={30} decorative />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-sm font-medium text-ink">{data.title}</span>
        {data.subtitle && (
          <span className="truncate font-mono text-node-sub text-ink-muted">{data.subtitle}</span>
        )}
      </span>
      {data.hasRules && (
        <Table
          role="img"
          aria-label="Has rules"
          strokeWidth={ICON_STROKE_WIDTH}
          className="size-3.5 shrink-0 text-primary-ink"
        />
      )}

      {SIDES.map(({ id: side, position }) => (
        <Handle
          key={side}
          id={side}
          type="source"
          position={position}
          role="button"
          aria-label={`Connect from ${data.title}`}
          tabIndex={tabIndex}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              openConnectPopover(id);
            }
          }}
          className={cn(
            'sd-handle opacity-0 group-hover/node:opacity-100 group-focus-within/node:opacity-100',
            focusRing,
            role !== null && 'opacity-100',
          )}
        />
      ))}
      {/* While a connection is drawn, the whole node is a drop target, not only its handles. */}
      {connecting && role !== 'source' && (
        <Handle
          id="body"
          type="target"
          position={Position.Top}
          isConnectableStart={false}
          aria-hidden
          className="sd-body-handle"
        />
      )}

      {target === 'ok' && (
        <span
          aria-hidden
          className="absolute -top-2.5 -right-2.5 flex size-5 items-center justify-center rounded-full bg-primary text-on-primary shadow-rest"
        >
          <Plus strokeWidth={2} className="size-3.5" />
        </span>
      )}
      {refusal && (
        <span
          role="note"
          className="absolute top-full left-0 z-10 mt-2 flex w-max items-center gap-1.5 rounded-row border border-clay-ink bg-surface px-2 py-1 text-caption text-clay-ink shadow-hover"
        >
          <Ban aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
          {refusal}
        </span>
      )}
    </div>
  );
});

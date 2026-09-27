import { cn } from '@sododeck/ui/lib/utils';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Box, Database, Globe, Monitor, Server, type LucideIcon } from 'lucide-react';
import { memo } from 'react';

import { NODE_SIZE, type DeckFlowNode } from './deck-to-flow';

interface Kind {
  Icon: LucideIcon;
  tile: string;
}

const DEFAULT_KIND: Kind = { Icon: Box, tile: 'bg-surface-2 text-ink-secondary' };

/** DESIGN.md kind-coded icon tiles. */
const KINDS: Record<string, Kind> = {
  service: { Icon: Server, tile: 'bg-primary-soft text-primary-ink' },
  database: { Icon: Database, tile: 'bg-blue-soft text-blue-ink' },
  client: { Icon: Monitor, tile: 'bg-surface-2 text-ink-secondary' },
  external: { Icon: Globe, tile: 'bg-clay-soft text-clay-ink' },
};

/** Canvas node, 164×50 (DESIGN.md "node"). */
export const DeckNode = memo(function DeckNode({ id, data, selected }: NodeProps<DeckFlowNode>) {
  const { Icon, tile } = KINDS[data.kind] ?? DEFAULT_KIND;
  return (
    <div
      data-testid="deck-node"
      style={NODE_SIZE}
      className={cn(
        'flex items-center gap-[9px] rounded-node border border-border bg-surface px-2.5 shadow-rest',
        selected && 'border-primary shadow-selection',
      )}
    >
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <span
        className={cn('flex size-[30px] shrink-0 items-center justify-center rounded-lg', tile)}
      >
        <Icon className="size-4" strokeWidth={1.5} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-body-sm font-medium text-ink">{data.title}</span>
        <span className="truncate font-mono text-node-sub text-ink-muted">{id}</span>
      </span>
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </div>
  );
});

import { useStore, type ReactFlowState } from '@xyflow/react';

/**
 * A node's role while a connection is drawn: `source`, `target:<fromId>` while the pointer is
 * over it, or null. Pure, so it can be tested without a pointer.
 *
 * React Flow only reports a hovered node (`toNode`) for handles it has measured; the body drop
 * target appears only while connecting, so the pointer is hit-tested against the node's box.
 */
const SELF_INSET = 10;

export function connectionRole(s: ReactFlowState, id: string): string | null {
  const c = s.connection;
  if (!c.inProgress) return null;
  const node = s.nodeLookup.get(id);
  if (node) {
    const [tx, ty, zoom] = s.transform;
    const x = (c.pointer.x - tx) / zoom;
    const y = (c.pointer.y - ty) / zoom;
    const { x: nx, y: ny } = node.internals.positionAbsolute;
    const width = node.measured.width ?? node.width ?? 0;
    const height = node.measured.height ?? node.height ?? 0;
    // Hovering the source's own box is the self case, shown on the source itself. A drag starts
    // on the source's edge handles, so the self case needs the pointer well inside its box.
    const inset = c.fromNode.id === id ? SELF_INSET : 0;
    if (x >= nx + inset && x <= nx + width - inset && y >= ny + inset && y <= ny + height - inset) {
      return `target:${c.fromNode.id}`;
    }
  }
  return c.fromNode.id === id ? 'source' : null;
}

/** One primitive per node, so a moving pointer re-renders at most the nodes whose role changes. */
export function useConnectionRole(id: string): string | null {
  return useStore((s) => connectionRole(s, id));
}

/** True while any connection is being drawn. */
export function useConnecting(): boolean {
  return useStore((s) => s.connection.inProgress);
}

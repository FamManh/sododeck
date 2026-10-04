import type { Id, SododeckFile } from '@sododeck/schema';

/** `{ tableId, columnId, label: 'orders.status' }` for every column linked to the enum. */
export function enumUsers(deck: SododeckFile, enumId: Id) {
  return deck.nodes.flatMap((node) =>
    (node.columns ?? [])
      .filter((column) => column.enumRef === enumId)
      .map((column) => ({
        tableId: node.id,
        columnId: column.id,
        label: `${node.title}.${column.name}`,
      })),
  );
}

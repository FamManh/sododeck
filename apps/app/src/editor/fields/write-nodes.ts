import type { DeckEditor } from '@sododeck/model';
import type { Node } from '@sododeck/schema';

export type NodePatch = Parameters<DeckEditor['update']>[2];

/**
 * Writes a patch to each component in one batch; `null` skips one. Inside a text field's gesture
 * the batch joins it (008 bulk edit).
 */
export function writeNodes(
  editor: DeckEditor,
  nodes: readonly Node[],
  patch: (node: Node) => NodePatch | null,
): void {
  editor.batch(() => {
    for (const node of nodes) {
      const p = patch(node);
      if (p !== null) editor.update('nodes', node.id, p);
    }
  });
}

/** `writeNodes` as an undo step of its own, however many components change (019 FR-025). */
export function writeNodesOnce(
  editor: DeckEditor,
  nodes: readonly Node[],
  patch: (node: Node) => NodePatch | null,
): void {
  editor.beginGesture();
  try {
    writeNodes(editor, nodes, patch);
  } finally {
    editor.endGesture();
  }
}

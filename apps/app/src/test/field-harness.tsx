import type { Node, SododeckFile } from '@sododeck/schema';

import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';
import { oneStep } from '../editor/fields/one-step';

/** Renders `field` for node `p`, with `write(patch)` bound to the editor. */
export function NodeFieldHarness({
  field,
}: {
  field: (
    node: Node,
    deck: SododeckFile,
    write: (patch: Parameters<ReturnType<typeof useEditor>['update']>[2]) => void,
  ) => React.ReactNode;
}) {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const node = deck.nodes.find((n) => n.id === 'p');
  if (node === undefined) return null;
  return field(node, deck, (patch) => {
    oneStep(editor, () => {
      editor.update('nodes', 'p', patch);
    });
  });
}

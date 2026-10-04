/**
 * The icon picker wired to the selection (038 T026): used by the toolbar popover and the
 * drawer's header tile. It reads the selected cards from the document, shows their shared icon
 * (or Mixed) and writes a pick or Reset to all of them through `applyIcon`, one undo step.
 */
import { effectiveFamily } from '@sododeck/model';
import { resolveIcon, type ResolvedIcon } from '@sododeck/ui/icon-sets';

import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore, type Selection } from '../../state/ui-store';
import { applyIcon } from './apply-icon';
import { IconPicker } from './icon-picker';

/** What the selected cards store: one resolved icon, nothing, or a disagreement. */
function currentOf(icons: readonly (string | undefined)[]): ResolvedIcon | 'mixed' | null {
  const [first] = icons;
  if (!icons.every((icon) => icon === first)) return 'mixed';
  const resolved = first === undefined ? null : resolveIcon(first);
  return resolved;
}

export function IconField({
  selection,
  onDone,
}: {
  selection: Selection;
  /** Called after a pick or Reset: the owner closes its popover. */
  onDone: () => void;
}) {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const selected = new Set(selection.nodes);
  const nodes = deck.nodes.filter((node) => selected.has(node.id));
  const cards = nodes.filter((node) => effectiveFamily(node) === 'card');
  const others =
    nodes.length -
    cards.length +
    selection.edges.length +
    selection.groups.length +
    selection.stickies.length;
  // Two references to the same icon (`server`, `lucide:server`) count as the same icon.
  const keyed = cards.map((card) => {
    const resolved = card.icon === undefined ? null : resolveIcon(card.icon);
    return resolved === null ? card.icon : `${resolved.set}:${resolved.name}`;
  });

  // One shared reference the app cannot read: say so; with differing icons the header says Mixed.
  const storedFirst = cards[0]?.icon;
  const unavailable =
    storedFirst !== undefined &&
    keyed.every((key) => key === keyed[0]) &&
    resolveIcon(storedFirst) === null
      ? storedFirst
      : null;

  const done = (message: string) => {
    useUiStore.getState().announce(message);
    onDone();
  };
  const count = `${String(cards.length)} ${cards.length === 1 ? 'card' : 'cards'}`;

  return (
    <IconPicker
      current={currentOf(keyed)}
      cardCount={cards.length}
      showScope={cards.length > 1 || others > 0}
      canReset={cards.some((card) => card.icon !== undefined)}
      unavailable={unavailable}
      usage={[]}
      onPick={(ref) => {
        applyIcon(editor, selection, ref);
        done(`Icon set to ${resolveIcon(ref)?.label ?? ref} on ${count}`);
      }}
      onReset={() => {
        applyIcon(editor, selection, null);
        done(`Icon reset to the type icon on ${count}`);
      }}
    />
  );
}

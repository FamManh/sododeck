/**
 * Writes one style channel for the current selection as one undo step (020 T030, R2): announces
 * the change per `contracts/card-style-ui.md`. Selection ids that aren't a node or a group (edges,
 * stickies) are never passed to `setStyle`, which only accepts node and group targets.
 */
import { MAX_SWATCHES } from '@sododeck/model';
import type { DeckEditor, StyleChannel, StyleTargets } from '@sododeck/model';
import type { ColorRef } from '@sododeck/schema';

import { oneStep } from '../fields/one-step';
import type { Selection } from '../../state/ui-store';
import { useUiStore } from '../../state/ui-store';
import { readDeck } from '../../model/use-deck-snapshot';
import { colourName } from './card-style';

/** The word for the announcement: "group(s)" only when every target is a group. */
function targetWord(targets: StyleTargets): { count: number; word: string } {
  const nodes = targets.nodes.length;
  const groups = targets.groups.length;
  const count = nodes + groups;
  const word =
    nodes === 0 && groups > 0
      ? groups === 1
        ? 'group'
        : 'groups'
      : count === 1
        ? 'component'
        : 'components';
  return { count, word };
}

export function applyStyle(
  editor: DeckEditor,
  selection: Selection,
  channel: StyleChannel,
  value: ColorRef | null,
): void {
  const targets: StyleTargets = { nodes: selection.nodes, groups: selection.groups };
  oneStep(editor, () => {
    editor.setStyle(targets, channel, value);
  });

  const { count, word } = targetWord(targets);
  const channelLabel = channel === 'fill' ? 'Fill' : 'Stroke';
  const message =
    value === null
      ? `${channelLabel} removed from ${String(count)} ${word}`
      : `${channelLabel} set to ${colourName(value)} on ${String(count)} ${word}`;
  useUiStore.getState().announce(message);
}

/** How many selected items can't be coloured (edges, stickies): 020 T037, contract footer. */
export function skippedCount(selection: Selection): number {
  return selection.edges.length + selection.stickies.length;
}

/**
 * Saves a new hex colour to the deck's swatches and applies it to the selection, in one undo
 * step (020 T044/T046, contract "Add a deck colour"). The UI never offers "Add" at the
 * {@link MAX_SWATCHES} cap, but this still guards against it: returns `false` and writes nothing
 * rather than relying on `editor.addSwatch`'s throw.
 */
export function addDeckColour(
  editor: DeckEditor,
  selection: Selection,
  channel: StyleChannel,
  hex: string,
): boolean {
  const swatches = readDeck(editor.doc).swatches ?? [];
  if (!swatches.includes(hex) && swatches.length >= MAX_SWATCHES) return false;

  const targets: StyleTargets = { nodes: selection.nodes, groups: selection.groups };
  oneStep(editor, () => {
    editor.addSwatch(hex);
    editor.setStyle(targets, channel, hex);
  });

  const savedAt = (readDeck(editor.doc).swatches ?? []).length;
  useUiStore
    .getState()
    .announce(`Saved to this deck as ${String(savedAt)} of ${String(MAX_SWATCHES)}`);
  return true;
}

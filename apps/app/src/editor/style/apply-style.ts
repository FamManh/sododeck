/**
 * Writes one style channel for the current selection as one undo step (020 T030, R2): announces
 * the change per `contracts/card-style-ui.md`. Selection ids that aren't a node or a group (edges,
 * stickies) are never passed to `setStyle`, which only accepts node and group targets.
 */
import type { DeckEditor, StyleChannel, StyleTargets } from '@sododeck/model';
import type { ColorRef } from '@sododeck/schema';

import { oneStep } from '../fields/one-step';
import type { Selection } from '../../state/ui-store';
import { useUiStore } from '../../state/ui-store';
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

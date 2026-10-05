import { endpointOf } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

export type NotesDisplay = 'dimmed' | 'shown' | 'hidden';
export type StickyFlowState = 'normal' | 'dimmed' | 'hidden';

/**
 * How a note looks while a flow plays: hidden or shown by the Notes setting, else at full strength
 * when it asks to stay visible (`showInFlows`) or the flow has no steps yet, dimmed otherwise.
 * Notes are never pinned to a card (ADR 0041), so the current step does not change this.
 */
export function stickyFlowState(
  sticky: Pick<SododeckFile['stickies'][number], 'showInFlows'>,
  options: { flowMode: boolean; display: NotesDisplay; emptyFlow: boolean },
): StickyFlowState {
  if (!options.flowMode) return 'normal';
  if (options.display === 'hidden') return 'hidden';
  if (options.display === 'shown' || sticky.showInFlows === true) return 'normal';
  if (options.emptyFlow) return 'normal';
  return 'dimmed';
}

/**
 * Whether a connector ends on a note (053). Such a connector is a comment, not a step: flows
 * work on cards and groups, so it is never offered or recorded as one. A card or group that
 * shares the id with a note wins, as `endpointOf` resolves it.
 */
export function endsOnNote(
  deck: Pick<SododeckFile, 'nodes' | 'groups' | 'stickies'>,
  edge: Pick<SododeckFile['edges'][number], 'from' | 'to'>,
): boolean {
  if (deck.stickies.length === 0) return false;
  return [edge.from, edge.to].some((id) => endpointOf(deck, id)?.kind === 'sticky');
}

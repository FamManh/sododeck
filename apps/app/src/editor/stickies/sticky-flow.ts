import { endpointOf, type StickyPlacement } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

import type { NodeFlowMark } from '../flows/flow-overlay';

export type NotesDisplay = 'dimmed' | 'shown' | 'hidden';
export type StickyFlowState = 'normal' | 'dimmed' | 'hidden';

export function stickyFlowState(
  sticky: SododeckFile['stickies'][number],
  placement: StickyPlacement,
  options: {
    flowMode: boolean;
    display: NotesDisplay;
    currentStepNodes: ReadonlyMap<string, NodeFlowMark>;
    emptyFlow: boolean;
    brokenCurrentStep: boolean;
  },
): StickyFlowState {
  if (!options.flowMode) return 'normal';
  if (options.display === 'hidden') return 'hidden';
  if (options.display === 'shown' || sticky.showInFlows === true) return 'normal';
  if (options.emptyFlow) return 'normal';
  if (placement.status === 'pinned') {
    return options.currentStepNodes.get(placement.pinnedTo)?.currentStep === true
      ? 'normal'
      : 'dimmed';
  }
  if (options.brokenCurrentStep) return 'dimmed';
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

export function notesOnStep(
  deck: SododeckFile,
  fromId: string,
  toId: string,
): readonly SododeckFile['stickies'][number][] {
  return deck.stickies.filter((sticky) => sticky.anchor === fromId || sticky.anchor === toId);
}

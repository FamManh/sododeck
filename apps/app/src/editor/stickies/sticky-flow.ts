import type { StickyPlacement } from '@sododeck/model';
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

export function notesOnStep(
  deck: SododeckFile,
  fromId: string,
  toId: string,
): readonly SododeckFile['stickies'][number][] {
  return deck.stickies.filter((sticky) => sticky.anchor === fromId || sticky.anchor === toId);
}

import type { SododeckFile } from '@sododeck/schema';

import { useUiStore } from '../../state/ui-store';
import { addingBranchInfo } from './flow-session';
import { findFlow } from './session-path';

/**
 * Done while adding a branch (FR-023): an empty label or condition shows the inline errors and
 * keeps the branch open; otherwise the branch is confirmed and recording continues in it.
 * Returns true when confirmed.
 */
export function confirmBranch(deck: SododeckFile): boolean {
  const ui = useUiStore.getState();
  const session = ui.flowSession;
  if (session === null) return false;
  const info = addingBranchInfo(deck, session);
  if (info === null) return false;
  const branch = findFlow(deck, session.flowId)?.branches?.find((b) => b.id === info.branchId);
  if (branch === undefined) return false;
  if (branch.label.trim() === '' || branch.condition.trim() === '') {
    ui.checkBranch();
    ui.announce('The branch needs a label and a condition.');
    return false;
  }
  ui.setAddingBranch(false);
  ui.announce(`Branch ‘${branch.label}’ added after step ${info.afterNumber}`);
  return true;
}

import type { Selection } from '../../state/ui-store';
import { targetOf } from '../actions/use-action-context';

export type ToolbarVariant =
  | 'component'
  | 'components'
  | 'connection'
  | 'connections'
  | 'group'
  | 'sticky'
  | 'stickies'
  | 'mixed'
  | 'none';

/** Which selection toolbar shows (019 R5, 053): none for nothing; notes only get their own. */
export function toolbarVariant(selection: Selection): ToolbarVariant {
  const target = targetOf(selection);
  // A row is a menu target only (043); a selection is never one.
  if (target.kind === 'canvas' || target.kind === 'row') return 'none';
  if (target.kind === 'sticky') return selection.stickies.length === 1 ? 'sticky' : 'stickies';
  return target.kind;
}

import type { Selection } from '../../state/ui-store';
import { targetOf } from '../actions/use-action-context';

export type ToolbarVariant = 'component' | 'components' | 'connection' | 'group' | 'mixed' | 'none';

/** Which selection toolbar shows (019 R5): none for nothing or only stickies (they have none). */
export function toolbarVariant(selection: Selection): ToolbarVariant {
  const target = targetOf(selection);
  return target.kind === 'canvas' || target.kind === 'sticky' ? 'none' : target.kind;
}

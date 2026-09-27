import { isApplePlatform } from '../../lib/features';
import { useUiStore } from '../../state/ui-store';
import { useUndoToast } from '../undo-toast';

/** Detach without a dialog, with an Undo toast and an announcement (FR-030). */
export function useDetach(): (title: string, detach: () => void) => void {
  const showUndoToast = useUndoToast();
  return (title, detach) => {
    detach();
    useUiStore.getState().announce('Rule detached');
    showUndoToast(`Rule “${title}” detached · ${isApplePlatform() ? '⌘Z' : 'Ctrl+Z'} to undo`);
  };
}

import { useUiStore } from '../../state/ui-store';

/**
 * A popover's `onEscapeKeyDown` for a host of the picker: while the editor is open Escape goes
 * back to the list (the editor handles it) instead of closing the popover.
 */
export function tagPickerEscape(event: KeyboardEvent): void {
  if (useUiStore.getState().tagEditing) event.preventDefault();
}

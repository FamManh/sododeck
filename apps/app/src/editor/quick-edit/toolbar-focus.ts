import { useUiStore } from '../../state/ui-store';
import { focusCanvas, nodeElement } from '../canvas-actions';
import { COLLAPSED_NODE_PREFIX, GROUP_NODE_PREFIX } from '../deck-to-flow';

/** Marks the toolbar, for ⌘E and for keys that must leave it alone. */
export const QUICK_TOOLBAR_ATTR = 'data-quick-toolbar';

/** Moves focus to the toolbar's first button (⌘E); false when no toolbar is shown. */
export function focusSelectionToolbar(): boolean {
  const button = document.querySelector<HTMLElement>(
    `[${QUICK_TOOLBAR_ATTR}] button:not([disabled])`,
  );
  button?.focus();
  return button !== null;
}

/** Gives focus back to the selected object (Esc, or Tab past the last button). */
export function focusSelectedObject(): void {
  const ui = useUiStore.getState();
  const [group] = ui.selection.groups;
  const target =
    ui.focusedId ??
    ui.selection.nodes[0] ??
    (group === undefined ? undefined : `${GROUP_NODE_PREFIX}${group}`);
  const element =
    target === undefined
      ? null
      : (nodeElement(target) ??
        (group === undefined ? null : nodeElement(`${COLLAPSED_NODE_PREFIX}${group}`)));
  if (element !== null) element.focus({ preventScroll: true });
  else focusCanvas();
}

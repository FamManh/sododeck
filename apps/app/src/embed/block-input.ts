/**
 * Keeps keyboard shortcuts and paste from reaching the editor while a refused file is shown
 * (067 R6). The `inert` attribute stops pointer and focus inside the editor, but the editor's
 * shortcuts listen on the document, and a key pressed with focus on the page body (where inert
 * drops it) would still reach them: Delete would remove the selected card. A capture listener on
 * the window runs first and ends those events there. Copy stays: it changes nothing.
 */
const BLOCKED = ['keydown', 'keyup', 'keypress', 'paste', 'cut', 'beforeinput'] as const;

export function blockEditingInput(): () => void {
  const stop = (event: Event) => {
    event.stopImmediatePropagation();
    event.preventDefault();
  };
  for (const type of BLOCKED) window.addEventListener(type, stop, { capture: true });
  return () => {
    for (const type of BLOCKED) window.removeEventListener(type, stop, { capture: true });
  };
}

/**
 * True when the key belongs to a text field (typing, native text undo). A Monaco editor (the DBML
 * tab, 046) types into an edit-context element that is not an input, so it counts by its class.
 */
export function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable ||
    target.closest('[contenteditable=""], [contenteditable="true"], .monaco-editor') !== null
  );
}

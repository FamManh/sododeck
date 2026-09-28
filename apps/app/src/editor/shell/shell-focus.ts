import { canvasElement } from '../canvas-actions';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';

/** After the JSON overlay renders, moves focus into it (⌘J, 018 FR-030). */
export function focusJsonOverlay(): void {
  requestAnimationFrame(() => {
    const overlay = document.querySelector<HTMLElement>('[data-json-overlay]');
    const target =
      overlay?.querySelector<HTMLElement>('.monaco-editor textarea') ??
      overlay?.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();
  });
}

/** Gives focus back to the canvas (Esc in an overlay). */
export function focusCanvas(): void {
  canvasElement()?.focus();
}

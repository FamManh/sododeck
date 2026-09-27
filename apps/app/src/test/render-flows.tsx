import type { SododeckFile } from '@sododeck/schema';
import userEvent from '@testing-library/user-event';

import { useUiStore } from '../state/ui-store';
import { FlowHarness } from './flow-harness';
import { renderWithEditor } from './render-canvas';

/** The flow UI (chip, left panel, inspector, delete dialog, live region) on a real editor. */
export function renderFlows(file: SododeckFile) {
  const view = renderWithEditor(<FlowHarness />, file);
  return { ...view, user: userEvent.setup(), ui: () => useUiStore.getState() };
}

/** Text of the polite live region. */
export function announced(): string {
  return useUiStore.getState().announcement.text;
}

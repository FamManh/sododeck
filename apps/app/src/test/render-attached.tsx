import type { SododeckFile } from '@sododeck/schema';
import { act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { RuleNavContext, type RuleNav } from '../editor/rules/rule-nav';
import { useUiStore } from '../state/ui-store';
import { FlowHarness } from './flow-harness';
import { renderWithEditor } from './render-canvas';

/**
 * The flow UI with a spy for the rule editor navigation; shows `step` of `flow`, or selects
 * component `node`.
 */
export function renderAttached(
  deck: SododeckFile,
  target: { flow: string; step: string } | { node: string },
) {
  const openRules = vi.fn<RuleNav['openRules']>();
  const view = renderWithEditor(
    <RuleNavContext value={{ openRules }}>
      <FlowHarness />
    </RuleNavContext>,
    deck,
  );
  act(() => {
    const ui = useUiStore.getState();
    if ('node' in target) ui.select({ nodes: [target.node] });
    else {
      ui.setActiveFlow(target.flow);
      ui.setActiveStep(target.step);
    }
  });
  return { ...view, openRules, user: userEvent.setup(), ui: useUiStore.getState };
}

import type { SododeckFile } from '@sododeck/schema';
import { act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useUiStore, type Selection } from '../state/ui-store';
import { InspectorView } from './inspector-view';
import { renderWithEditor } from './render-canvas';

/** Renders the inspector over `deck` with `selection` selected. */
export function renderInspector(
  deck: SododeckFile,
  selection: Partial<Selection> = {},
  onOpenRules?: () => void,
) {
  const view = renderWithEditor(<InspectorView onOpenRules={onOpenRules} />, deck);
  act(() => {
    useUiStore.getState().select(selection);
  });
  return { ...view, user: userEvent.setup(), ui: useUiStore.getState };
}

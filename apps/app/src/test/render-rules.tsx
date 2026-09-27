import type { SododeckFile } from '@sododeck/schema';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { RulesPage } from '../editor/rules/rules-page';
import { useUiStore } from '../state/ui-store';
import { editorWrapper } from './render-canvas';
import { RulesChrome } from './rules-chrome';

/** The rule editor at `path` (default: the rule list) over a fresh doc of `deck`. */
export function renderRules(deck: SododeckFile, path = '/deck/d/rules') {
  const { wrapper, doc, editor } = editorWrapper(deck);
  const router = createMemoryRouter(
    [
      {
        path: '/deck/:deckId',
        element: <RulesChrome />,
        children: [{ path: 'rules/:ruleId?', element: <RulesPage /> }],
      },
    ],
    { initialEntries: [path] },
  );
  const view = render(<RouterProvider router={router} />, { wrapper });
  return {
    ...view,
    doc,
    editor,
    router,
    path: () => router.state.location.pathname,
    user: userEvent.setup(),
    ui: useUiStore.getState,
  };
}

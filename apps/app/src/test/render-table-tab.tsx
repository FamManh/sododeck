import { toJSON } from '@sododeck/model';
import type { Node, SododeckFile } from '@sododeck/schema';
import userEvent from '@testing-library/user-event';
import type { ComponentType } from 'react';

import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';
import { renderWithEditor } from './render-canvas';

type TabProps = { deck: SododeckFile; node: Node };

/** Renders one table-drawer panel for `tableId`, re-reading the table after every change. */
export function renderTableTab(deck: SododeckFile, tableId: string, Tab: ComponentType<TabProps>) {
  function Harness() {
    const snapshot = useDeckSnapshot(useEditor().doc);
    const node = snapshot.nodes.find((n) => n.id === tableId);
    return node === undefined ? null : <Tab deck={snapshot} node={node} />;
  }
  const view = renderWithEditor(<Harness />, deck);
  const table = () => toJSON(view.doc).nodes.find((n) => n.id === tableId);
  return { ...view, user: userEvent.setup(), table };
}

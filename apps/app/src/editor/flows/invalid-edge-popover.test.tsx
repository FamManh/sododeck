import { toJSON } from '@sododeck/model';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { flowDeck } from '../../test/flow-fixtures';
import { renderWithEditor } from '../../test/render-canvas';
import { analysisOf, recordClick, startEditing } from './flow-session';
import { InvalidEdgePopover } from './invalid-edge-popover';

function Harness() {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const flowId = useUiStore((s) => s.flowSession?.flowId ?? null);
  return <InvalidEdgePopover deck={deck} analysis={analysisOf(deck, flowId)} />;
}

function setup() {
  const view = renderWithEditor(<Harness />, flowDeck);
  act(() => {
    startEditing(view.editor(), 'place');
  });
  return { ...view, user: userEvent.setup() };
}

describe('InvalidEdgePopover (US2, FR-010, FR-011)', () => {
  it('explains a refused click, announces it, and adds nothing', async () => {
    const { editor, doc, user } = setup();
    act(() => {
      recordClick(editor(), 'ab');
    });
    const popover = screen.getByRole('dialog', { name: "Can't add this edge as step 3" });
    expect(popover).toHaveTextContent("It doesn't start at Order Service.");
    expect(useUiStore.getState().announcement.text).toBe(
      "Can't add Customer App → API Gateway as step 3. It doesn't start at Order Service.",
    );
    expect(toJSON(doc).flows[0]?.steps).toHaveLength(2);
    expect(within(popover).queryByRole('button', { name: /Add as branch/ })).toBeNull();
    await user.click(within(popover).getByRole('button', { name: 'Got it' }));
    expect(useUiStore.getState().flowSession?.invalid).toBeNull();
  });

  it('offers "Add as branch from step k" and starts the branch with that edge', async () => {
    const { editor, doc, user } = setup();
    act(() => {
      recordClick(editor(), 'bb');
    });
    const popover = screen.getByRole('dialog', { name: "Can't add this edge as step 3" });
    await user.click(within(popover).getByRole('button', { name: 'Add as branch from step 1' }));
    const flow = toJSON(doc).flows[0];
    expect(flow?.branches).toHaveLength(2);
    expect(flow?.steps.at(-1)).toMatchObject({ edge: 'bb', branch: flow?.branches?.[1]?.id });
    expect(useUiStore.getState().flowSession).toMatchObject({ addingBranch: true, invalid: null });
  });
});

import type { SododeckFile } from '@sododeck/schema';
import { Panel, PanelSection } from '@sododeck/ui/components/panel';

import { Announcer } from '../editor/announcer';
import { ConfirmDeleteDialog } from '../editor/confirm-delete-dialog';
import { SessionChip } from '../editor/flows/session-chip';
import { StepPlayer } from '../editor/flows/step-player';
import { useFlowShortcuts, usePlaybackShortcuts } from '../editor/flows/use-flow-shortcuts';
import { useFlowSync } from '../editor/flows/use-flow-sync';
import { Inspector } from '../editor/inspector';
import { FlowList } from '../editor/flows/flow-list';
import { FlowPanel } from '../editor/flows/flow-panel';
import { useEditorShortcuts } from '../editor/use-canvas-shortcuts';
import { useUiStore } from '../state/ui-store';
import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';

/**
 * What the Flows & features flyout shows (018): the flow's steps in flow mode and during a
 * session, else the features and their flows. Named like the old left column for the tests.
 */
function FlowColumn({ deck }: { deck: SododeckFile }) {
  const inFlow = useUiStore((s) => s.flowSession !== null || s.activeFlow !== null);
  return inFlow ? (
    <Panel aria-label="Flow">
      <FlowPanel deck={deck} />
    </Panel>
  ) : (
    <Panel aria-label="Outline">
      <PanelSection label="Features" aria-label="Features">
        <FlowList deck={deck} />
      </PanelSection>
    </Panel>
  );
}

/** The flow UI (chip, flows column, inspector, step player, delete dialog, live region) for tests. */
export function FlowHarness() {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  useEditorShortcuts();
  useFlowShortcuts();
  usePlaybackShortcuts();
  useFlowSync();
  return (
    <>
      <SessionChip />
      <FlowColumn deck={deck} />
      <Inspector deck={deck} />
      <StepPlayer deck={deck} />
      <ConfirmDeleteDialog deck={deck} />
      <Announcer />
    </>
  );
}

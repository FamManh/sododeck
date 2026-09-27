import { Announcer } from '../editor/announcer';
import { ConfirmDeleteDialog } from '../editor/confirm-delete-dialog';
import { SessionChip } from '../editor/flows/session-chip';
import { useFlowShortcuts } from '../editor/flows/use-flow-shortcuts';
import { useFlowSync } from '../editor/flows/use-flow-sync';
import { Inspector } from '../editor/inspector';
import { LeftSidebar } from '../editor/left-sidebar';
import { useEditorShortcuts } from '../editor/use-canvas-shortcuts';
import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';

/** The flow UI (chip, left panel, inspector, delete dialog, live region) for tests. */
export function FlowHarness() {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  useEditorShortcuts();
  useFlowShortcuts();
  useFlowSync();
  return (
    <>
      <SessionChip />
      <LeftSidebar deck={deck} />
      <Inspector deck={deck} />
      <ConfirmDeleteDialog deck={deck} />
      <Announcer />
    </>
  );
}

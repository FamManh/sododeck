import { useOutlet } from 'react-router';

import { Announcer } from '../editor/announcer';
import { ConfirmDeleteDialog } from '../editor/confirm-delete-dialog';
import { useEditorShortcuts } from '../editor/use-canvas-shortcuts';
import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';
import { InspectorView } from './inspector-view';

/** The editor chrome for rule editor tests: the rules route, or the inspector as "canvas". */
export function RulesChrome() {
  const deck = useDeckSnapshot(useEditor().doc);
  const outlet = useOutlet();
  useEditorShortcuts({ canvas: outlet === null });
  return (
    <>
      {outlet ?? (
        <main aria-label="Canvas screen">
          <InspectorView />
        </main>
      )}
      <ConfirmDeleteDialog deck={deck} />
      <Announcer />
    </>
  );
}

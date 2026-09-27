import { fromJSON, serializeDeck } from '@sododeck/model';
import { ReactFlowProvider } from '@xyflow/react';
import { useMemo, useState } from 'react';

import { Canvas } from '../editor/canvas';
import { demoDeck, demoPositions } from '../editor/demo-deck';
import { Inspector } from '../editor/inspector';
import { JsonPanel } from '../editor/json-panel';
import { LeftSidebar } from '../editor/left-sidebar';
import { TopBar } from '../editor/top-bar';
import { useDeckSnapshot } from '../model/use-deck-snapshot';

/**
 * Editor shell. The Yjs document is the single source of truth; every panel
 * renders from `useDeckSnapshot(doc)`. TODO(M1): load the deck by :deckId from
 * IndexedDB (y-indexeddb) instead of the demo.
 */
export function EditorPage() {
  const [doc] = useState(() => fromJSON(demoDeck));
  const deck = useDeckSnapshot(doc);
  const json = useMemo(() => serializeDeck(deck), [deck]);

  return (
    <div className="grid h-dvh grid-rows-[56px_minmax(0,1fr)] bg-app">
      <TopBar deckName="Demo deck" />
      <div className="grid min-h-0 grid-cols-[264px_minmax(0,1fr)_336px] gap-px bg-hairline">
        <LeftSidebar deck={deck} />
        <main className="flex min-h-0 flex-col bg-canvas">
          <div className="min-h-0 flex-1">
            <ReactFlowProvider>
              <Canvas deck={deck} positions={demoPositions} />
            </ReactFlowProvider>
          </div>
          <JsonPanel json={json} />
        </main>
        <Inspector deck={deck} />
      </div>
    </div>
  );
}

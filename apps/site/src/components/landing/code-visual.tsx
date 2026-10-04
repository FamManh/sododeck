import { MousePointer2 } from 'lucide-react';

import type { Breakpoint } from '../../lib/landing/breakpoint';
import {
  DBML,
  DECK_JSON,
  DECK_JSON_REFS,
  EDGES,
  FRAMES,
  NODES,
  WORLD,
} from '../../lib/landing/checkout-deck';
import { CanvasPill } from './deck/canvas-pill';
import { CodePane } from './deck/code-pane';
import { DeckScene } from './deck/deck-scene';
import { NeutralChip } from './deck/neutral-chip';
import { Viewport } from './deck/viewport';

/** The cards a visitor can pick, by key, with the name their toggle button reads. */
const PICKABLE = { svc: 'Select Order Service', odb: 'Select Orders DB' } as const;

/**
 * Step 6 · Code: the Orders group beside the code panel. Picking Order Service or Orders DB
 * highlights its JSON lines (`landing-controls.ts`); Order Service is picked at first and without
 * JS. Only the Orders group is in the world, so nothing is cut.
 */
export function CodeVisual({ breakpoint }: { breakpoint: Breakpoint }) {
  const phone = breakpoint === 'phone';
  const height = phone ? 420 : 590;
  const canvas = (
    <Viewport
      width={breakpoint === 'desktop' ? 320 : phone ? '100%' : '47%'}
      height={height}
      offsetX="calc(50% - 392px)"
      offsetY={phone ? 6 : (590 - 394) / 2 - 8}
      worldWidth={WORLD.w}
      worldHeight={WORLD.h}
      over={
        <CanvasPill
          height={28}
          style={{ left: 12, bottom: 12, gap: 6, fontSize: 12, color: 'var(--sd-text-secondary)' }}
        >
          <MousePointer2 aria-hidden size={13} strokeWidth={2} />
          Pick a card
        </CanvasPill>
      }
    >
      <DeckScene
        nodes={[NODES.svc, NODES.odb]}
        edges={[EDGES.writes]}
        frames={[FRAMES.orders]}
        width={WORLD.w}
        height={WORLD.h}
        pickable={PICKABLE}
        picked="svc"
      />
    </Viewport>
  );
  const pane = (
    <CodePane
      width={breakpoint === 'desktop' ? 360 : phone ? '100%' : 'auto'}
      grow={breakpoint === 'tablet'}
      id={`deck-code-${breakpoint}`}
      height={590}
      panels={[
        { tab: 'JSON', lines: DECK_JSON, refs: DECK_JSON_REFS, foot: 'In sync with the canvas' },
        { tab: 'DBML', lines: DBML, foot: 'In sync with the canvas' },
      ]}
      selected="svc"
      narrow={phone}
      chip={
        <NeutralChip icon={<MousePointer2 aria-hidden size={13} strokeWidth={2} />}>
          Selection
        </NeutralChip>
      }
    />
  );
  return phone ? (
    <div className="flex flex-col gap-4" data-pick-root="">
      {canvas}
      {pane}
    </div>
  ) : (
    <div className="flex gap-4" data-pick-root="">
      {canvas}
      {pane}
    </div>
  );
}

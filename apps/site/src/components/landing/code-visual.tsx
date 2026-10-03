import { MousePointer2 } from 'lucide-react';

import type { Breakpoint } from '../../lib/landing/breakpoint';
import {
  DECK_JSON,
  DECK_JSON_SELECTED,
  EDGES,
  FRAMES,
  NODES,
  WORLD,
} from '../../lib/landing/checkout-deck';
import { CodePane } from './deck/code-pane';
import { DeckScene } from './deck/deck-scene';
import { NeutralChip } from './deck/neutral-chip';
import { Viewport } from './deck/viewport';

/**
 * Step 6 · Code: the Orders group with Order Service selected, beside the code panel where its
 * JSON lines are highlighted. Only the Orders group is in the world, so nothing is cut.
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
      label="Order Service selected on the canvas, above Orders DB in the Orders group."
    >
      <DeckScene
        nodes={[NODES.svc, NODES.odb]}
        edges={[EDGES.writes]}
        frames={[FRAMES.orders]}
        width={WORLD.w}
        height={WORLD.h}
        nodeState={{ svc: { selected: true } }}
      />
    </Viewport>
  );
  const pane = (
    <CodePane
      width={breakpoint === 'desktop' ? 360 : phone ? '100%' : 'auto'}
      grow={breakpoint === 'tablet'}
      height={590}
      tabs={['JSON', 'DBML']}
      active={0}
      lines={DECK_JSON}
      highlight={DECK_JSON_SELECTED}
      foot="In sync with the canvas"
      narrow={phone}
      chip={
        <NeutralChip icon={<MousePointer2 aria-hidden size={13} strokeWidth={2} />}>
          Selection
        </NeutralChip>
      }
    />
  );
  return phone ? (
    <div className="flex flex-col gap-4">
      {canvas}
      {pane}
    </div>
  ) : (
    <div className="flex gap-4">
      {canvas}
      {pane}
    </div>
  );
}

import { Table } from 'lucide-react';

import type { Breakpoint } from '../../lib/landing/breakpoint';
import { EDGES, NODES, type SceneNode } from '../../lib/landing/checkout-deck';
import { C } from '../../lib/landing/tokens';
import { DeckScene } from './deck/deck-scene';
import { Viewport } from './deck/viewport';
import { StepInspector } from './step-inspector';

const W = 380;
const H = 440;

const NODES_HERE: readonly SceneNode[] = [
  { ...NODES.pay, x: 28, y: 44 },
  { ...NODES.psp, x: 28, y: 320 },
  {
    key: 'note',
    kind: 'shape',
    // Clear of the card's right edge (212), as on the board.
    x: 214,
    y: 40,
    shape: { shape: 'sticky', title: 'Ask finance about partial refunds', w: 130, h: 124 },
  },
];

/** The rule attached to the "charge" step, beside its label. */
const ruleTag = (
  <>
    <div
      style={{
        position: 'absolute',
        left: 146,
        top: 226,
        width: 16,
        height: 2,
        background: C.amberInk,
        zIndex: 2,
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: 160,
        top: 213,
        height: 28,
        padding: '0 10px',
        borderRadius: 99,
        background: C.amberSoft,
        color: C.amberInk,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        zIndex: 2,
        boxShadow: `0 2px 0 0 ${C.amberInk}`,
      }}
    >
      <Table aria-hidden size={13} strokeWidth={2} />
      R-12 Payment retry
    </div>
  </>
);

/** Step 4 · Knowledge: rule R-12 on the "charge" step, the step inspector, and a sticky. */
export function KnowledgeVisual({ breakpoint }: { breakpoint: Breakpoint }) {
  const scene = (
    <DeckScene
      nodes={NODES_HERE}
      edges={[EDGES.charge]}
      frames={[]}
      width={W}
      height={H}
      edgeState={{ '5': 'current' }}
      nodeState={{
        pay: { step: { state: 'played', n: 5 } },
        psp: { step: { state: 'current', n: 6 } },
      }}
    >
      {ruleTag}
    </DeckScene>
  );
  const label =
    'Flow step 6, Payment Service to Payment Provider over "charge", with rule R-12 Payment retry attached and a sticky note: Ask finance about partial refunds.';
  if (breakpoint === 'desktop') {
    return (
      <Viewport
        width={696}
        height={560}
        offsetY={20}
        worldWidth={W}
        worldHeight={H}
        label={label}
        over={
          <StepInspector
            style={{ position: 'absolute', right: 14, top: 14, bottom: 14, width: 304, zIndex: 8 }}
          />
        }
      >
        {scene}
      </Viewport>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <Viewport
        width="100%"
        height={460}
        offsetX={`calc(50% - ${String(W / 2)}px)`}
        worldWidth={W}
        worldHeight={H}
        label={label}
      >
        {scene}
      </Viewport>
      <StepInspector />
    </div>
  );
}

import { Database } from 'lucide-react';

import type { Breakpoint } from '../../lib/landing/breakpoint';
import { DBML } from '../../lib/landing/checkout-deck';
import { NARROW, WIDE } from '../../lib/landing/schema-worlds';
import { Timeline } from '../../lib/landing/timeline';
import { CodePane } from './deck/code-pane';
import { NeutralChip } from './deck/neutral-chip';
import { Viewport } from './deck/viewport';
import { SchemaWorld } from './schema-world';
import { Stage } from './stage';

const LABEL =
  'Inside Orders DB: tables orders, order_items and payments, enum order_status, and customers outside in Accounts DB. Relationships join order_id to orders.id and customer_id to customers.id. Flow Checkout writes orders at step 4 and payments at step 5.';

/**
 * Step 5 · Database (L3): the Orders DB card opens into its tables; playing Checkout lights up
 * the two tables it writes; the code pane shows the same schema as DBML for a Postgres deck.
 */
export function DatabaseVisual({ breakpoint }: { breakpoint: Breakpoint }) {
  const tl = new Timeline(2.4, false);
  const phone = breakpoint === 'phone';
  const world = phone ? NARROW : WIDE;
  const canvas = (
    <Stage timeline={tl} replay="top">
      <Viewport
        width={breakpoint === 'desktop' ? 820 : '100%'}
        height={breakpoint === 'desktop' ? 600 : phone ? 560 : 520}
        scale={breakpoint === 'desktop' ? 1 : phone ? 0.78 : 0.84}
        offsetX={
          breakpoint === 'desktop' ? 0 : phone ? 'calc(50% - 163.8px)' : 'calc(50% - 344.4px)'
        }
        offsetY={breakpoint === 'desktop' ? 0 : phone ? 2 : 6}
        worldWidth={world.width}
        worldHeight={world.height}
        label={LABEL}
      >
        <SchemaWorld world={world} tl={tl} />
      </Viewport>
    </Stage>
  );
  const pane = (
    <CodePane
      width={breakpoint === 'desktop' ? 360 : '100%'}
      height={breakpoint === 'desktop' ? 600 : 590}
      tabs={['JSON', 'DBML', 'SQL']}
      active={1}
      lines={DBML}
      highlight={[3]}
      foot="Edits apply as you type"
      narrow={phone}
      chip={
        <NeutralChip icon={<Database aria-hidden size={13} strokeWidth={2} />}>
          Postgres
        </NeutralChip>
      }
    />
  );
  return breakpoint === 'desktop' ? (
    <div className="flex gap-5">
      {canvas}
      {pane}
    </div>
  ) : (
    <div className="flex flex-col gap-4">
      {canvas}
      {pane}
    </div>
  );
}

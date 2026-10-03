import { Play } from 'lucide-react';
import type { ReactNode } from 'react';

import { NODES, ORDER_STATUS } from '../../lib/landing/checkout-deck';
import { layoutRelationship, tableGeometry, type Endpoint } from '../../lib/landing/schema';
import type { World } from '../../lib/landing/schema-worlds';
import { animate, withAnimation, type Timeline } from '../../lib/landing/timeline';
import { C, FONT_MONO } from '../../lib/landing/tokens';
import { Crumb } from './deck/crumb';
import { DeckCard } from './deck/deck-card';
import { EnumCard } from './deck/enum-card';
import { FloatingPanel } from './deck/floating-panel';
import { GroupFrame } from './deck/group-frame';
import { KeyCap } from './deck/key-cap';
import { RelationshipPath } from './deck/relationship-path';
import { TableCard } from './deck/table-card';
import { TableProxy } from './deck/table-proxy';

const at = (key: string, x: number, y: number, children: ReactNode) => (
  <div key={key} style={{ position: 'absolute', left: x, top: y, zIndex: 1 }}>
    {children}
  </div>
);

/** "Inside Orders DB": the schema board, with the tables the Checkout flow writes lit on `tl`. */
export function SchemaWorld({ world, tl }: { world: World; tl: Timeline }) {
  const endpoints = new Map<string, Endpoint>();
  for (const placed of world.tables) {
    const g = tableGeometry(placed.table);
    endpoints.set(placed.key, { x: placed.x, y: placed.y, w: g.w, rowY: g.rowY });
  }
  endpoints.set('cust', { ...world.proxy, rowY: () => 23 });
  const byKey = new Map(world.tables.map((t) => [t.key, t]));
  return (
    <>
      <GroupFrame frame={{ ...world.frame, title: ' Orders DB', count: 3, color: 'blue' }} />
      <svg
        aria-hidden
        width={world.width}
        height={world.height}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          overflow: 'visible',
          pointerEvents: 'none',
        }}
      >
        {world.relationships.map((rel) => {
          const from = endpoints.get(rel.from);
          const to = endpoints.get(rel.to);
          if (from === undefined || to === undefined) return null;
          return (
            <RelationshipPath
              key={`${rel.from}.${rel.fromColumn}`}
              layout={layoutRelationship(rel, from, to)}
            />
          );
        })}
      </svg>
      {world.tables.map((placed) =>
        at(placed.key, placed.x, placed.y, <TableCard table={placed.table} />),
      )}
      {world.enumAt !== undefined &&
        at('enum', world.enumAt.x, world.enumAt.y, <EnumCard data={ORDER_STATUS} />)}
      {at(
        'proxy',
        world.proxy.x,
        world.proxy.y,
        <TableProxy name="customers" detail="Accounts DB · outside" width={world.proxy.w} />,
      )}
      {world.card !== undefined &&
        at(
          'card',
          world.card.x,
          world.card.y,
          <div style={{ width: 184 }}>
            <DeckCard card={NODES.odb.card} state={{ selected: true }} />
          </div>,
        )}
      {world.lit.map((lit) => {
        const placed = byKey.get(lit.key);
        if (placed === undefined) return null;
        return (
          <div
            key={lit.key}
            {...withAnimation(
              { position: 'absolute', left: placed.x, top: placed.y, zIndex: 3 },
              animate(tl, [
                [lit.at, { opacity: 0 }],
                [lit.at + 0.3, { opacity: 1 }],
              ]),
            )}
          >
            <TableCard table={placed.table} step={lit.n} writes={lit.writes} />
          </div>
        );
      })}
      {world.card !== undefined && (
        <>
          <svg
            aria-hidden
            width={world.width}
            height={world.height}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              overflow: 'visible',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            <path
              d="M210 150H228"
              stroke={C.inkSecondary}
              strokeWidth={2}
              strokeDasharray="3 4"
              strokeLinecap="round"
            />
            <path
              d="M226 145L232 150L226 155"
              stroke={C.inkSecondary}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              left: 24,
              top: 232,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11.5,
              color: C.inkSecondary,
            }}
          >
            Open with <KeyCap label="⏎" />
          </div>
        </>
      )}
      <Crumb parts={['Checkout', 'Orders', 'Orders DB']} style={world.crumb} />
      <div
        {...withAnimation(
          {
            position: 'absolute',
            left: world.flowBar.left,
            top: world.flowBar.top,
            ...(world.flowBar.width === undefined ? {} : { width: world.flowBar.width }),
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 6,
          },
          animate(tl, [
            [0.4, { opacity: 0 }],
            [0.7, { opacity: 1 }],
          ]),
        )}
      >
        <FloatingPanel
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 34,
            padding: '0 12px',
            borderRadius: 99,
            whiteSpace: 'nowrap',
          }}
        >
          <Play aria-hidden size={12} strokeWidth={2.5} color={C.primaryInk} />
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Checkout</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSecondary }}>
            4 writes orders · 5 writes payments
          </span>
        </FloatingPanel>
      </div>
    </>
  );
}

import { canonicalize } from '../src/key-order';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';

/** Canonical deck text the way `serializeDeck` writes a deck without pictures. */
export function textOf(file: unknown): string {
  return `${JSON.stringify(canonicalize(file), null, 2)}\n`;
}

export function emptyText(): string {
  return textOf(emptySododeckFile());
}

/** A small deck that touches every kind of the readable part. */
export function richDeck(): SododeckFile {
  return {
    ...emptySododeckFile(),
    name: 'Shop',
    description: 'The shop.\n\nSecond paragraph.',
    nodes: [
      {
        id: 'web',
        type: 'client',
        title: 'Web',
        description: 'Storefront',
        position: { x: 0, y: 0 },
      },
      { id: 'api', type: 'service', title: 'API', position: { x: 100, y: 0 } },
    ],
    groups: [{ id: 'g1', title: 'Backend', description: 'Servers' }],
    edges: [
      { id: 'e1', from: 'web', to: 'api', label: 'calls', description: 'HTTP' },
      { id: 'e2', from: 'api', to: 'web' },
    ],
    features: [{ id: 'f1', title: 'Checkout', description: 'Pay' }],
    flows: [
      {
        id: 'flow.a',
        title: 'Order',
        description: 'Place an order',
        steps: [
          { id: 'flow.a.s1', edge: 'e1', title: 'Send', description: 'go', notes: 'n1' },
          { id: 'flow.a.s2', edge: 'e2' },
        ],
      },
    ],
    rules: {
      r1: {
        title: 'Discount',
        description: 'Rules',
        hitPolicy: 'unique',
        inputs: [],
        outputs: [],
        rows: [],
      },
    },
    stickies: [{ id: 's1', text: 'Remember', position: { x: 5, y: 5 } }],
    views: [{ id: 'v1', title: 'Overview', type: 'system' }],
  } as unknown as SododeckFile;
}

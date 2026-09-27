import type { SododeckFile } from '@sododeck/schema';

import { deckOf } from './render-canvas';

export const fieldDeck: SododeckFile = deckOf({
  nodes: [
    { id: 'p', type: 'service', title: 'Pricing', owner: 'Orders', tags: ['pci'] },
    { id: 'q', type: 'service', title: 'Payment', owner: 'Payments', tags: ['pricing', 'core'] },
  ],
  edges: [{ id: 'pq', from: 'p', to: 'q', owner: 'Core' }],
  features: [{ id: 'f', title: 'Checkout', owner: 'Order desk' }],
});

import type { SododeckFile } from '@sododeck/schema';

import { deckOf } from './render-canvas';

/** A small documented deck for the inspector tests (008 stories 1–3). */
export const inspectorDeck: SododeckFile = deckOf({
  name: 'Logistics',
  groups: [{ id: 'core', title: 'Core' }],
  nodes: [
    { id: 'o', type: 'service', title: 'Order Service', owner: 'Orders', group: 'core' },
    {
      id: 'p',
      type: 'service',
      title: 'Pricing Service',
      owner: 'Orders',
      tech: 'Go',
      group: 'core',
      tags: ['critical', 'pci'],
    },
    {
      id: 'y',
      type: 'service',
      title: 'Payment Service',
      owner: 'Payments',
      tech: 'Go',
      tags: ['critical'],
    },
    {
      id: 'd',
      type: 'service',
      title: 'Dispatch Service',
      owner: 'Dispatch',
      tech: 'Go',
      tags: ['core'],
    },
  ],
  edges: [
    { id: 'op', from: 'o', to: 'p', label: 'quote', protocol: 'http' },
    { id: 'py', from: 'p', to: 'y', label: 'charge' },
    { id: 'dp', from: 'd', to: 'p' },
  ],
  flows: [
    {
      id: 'place',
      title: 'Place order',
      steps: [
        { id: 's1', edge: 'op' },
        { id: 's2', edge: 'py' },
      ],
    },
    {
      id: 'assign',
      title: 'Assign driver',
      steps: [
        { id: 't1', edge: 'dp' },
        { id: 't2', edge: 'op' },
      ],
    },
  ],
});

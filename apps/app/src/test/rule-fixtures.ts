import type { Rule, SododeckFile } from '@sododeck/schema';

import { deckOf } from './render-canvas';

/** The spec's Delivery tier table (story 4, design 04). */
export const deliveryTier: Rule = {
  title: 'Delivery tier',
  description: 'Picks vehicle, SLA and surcharge from distance, weight and priority.',
  hitPolicy: 'first',
  inputs: [
    { id: 'dist', label: 'Distance (km)' },
    { id: 'weight', label: 'Weight (kg)' },
    { id: 'prio', label: 'Priority' },
  ],
  outputs: [
    { id: 'veh', label: 'Vehicle' },
    { id: 'sla', label: 'SLA' },
    { id: 'fee', label: 'Surcharge' },
  ],
  rows: [
    { id: 'r1', when: ['≤ 5', '≤ 10', 'Express'], then: ['Bike', '45 min', '€4.00'] },
    { id: 'r2', when: ['≤ 5', '≤ 10', 'Standard'], then: ['Bike', '2 h', '€0.00'] },
    { id: 'r3', when: ['≤ 20', '≤ 30', ''], then: ['Van', '4 h', '€2.50'] },
    { id: 'r4', when: ['> 20', '≤ 30', 'Any'], then: ['Van', 'Next day', '€6.00'] },
    { id: 'r5', when: ['Any', '> 30', 'Any'], then: ['Truck', 'Next day', '€12.00'] },
  ],
};

/** Order → Pricing (place order step 4 uses the rule), Dispatch → Route (assign driver step 2). */
export const ruleDeck: SododeckFile = deckOf({
  name: 'Logistics',
  nodes: [
    { id: 'c', type: 'client', title: 'Customer App' },
    { id: 'o', type: 'service', title: 'Order Service' },
    { id: 'p', type: 'service', title: 'Pricing Service', rules: ['T'] },
    { id: 'd', type: 'service', title: 'Dispatch Service' },
    { id: 'r', type: 'service', title: 'Route Optimizer' },
  ],
  edges: [
    { id: 'co', from: 'c', to: 'o', label: 'POST /orders' },
    { id: 'op', from: 'o', to: 'p', label: 'quote', protocol: 'grpc' },
    { id: 'od', from: 'o', to: 'd' },
    { id: 'dr', from: 'd', to: 'r', label: 'route' },
  ],
  flows: [
    {
      id: 'place',
      title: 'Place order',
      steps: [
        { id: 'p1', edge: 'co' },
        {
          id: 'p2',
          edge: 'op',
          rules: ['T'],
          ruleInputs: { T: { dist: '5', weight: '10', prio: 'Express' } },
        },
      ],
    },
    {
      id: 'assign',
      title: 'Assign driver',
      steps: [
        { id: 'a1', edge: 'od' },
        { id: 'a2', edge: 'dr', rules: ['T'] },
      ],
    },
  ],
  rules: {
    T: deliveryTier,
    P: {
      title: 'Reattempt policy',
      hitPolicy: 'collect',
      inputs: [{ id: 'tries', label: 'Tries' }],
      outputs: [{ id: 'act', label: 'Action' }],
      rows: [{ id: 'q1', when: ['< 3'], then: ['Retry'] }],
    },
  },
});

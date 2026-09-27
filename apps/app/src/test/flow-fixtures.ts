/** Shared test deck for the flow modules: a → b → c → d, plus c → x (error path) and y (isolated). */
import type { Flow, SododeckFile } from '@sododeck/schema';

import type { FlowSession } from '../state/ui-store';
import { deckOf } from './render-canvas';

export const flowDeck: SododeckFile = deckOf({
  nodes: [
    { id: 'a', type: 'client', title: 'Customer App', position: { x: 0, y: 0 } },
    { id: 'b', type: 'service', title: 'API Gateway', position: { x: 200, y: 0 } },
    { id: 'c', type: 'service', title: 'Order Service', position: { x: 400, y: 0 } },
    { id: 'd', type: 'queue', title: 'Event Bus', position: { x: 600, y: 0 } },
    { id: 'x', type: 'service', title: 'Payment Service', position: { x: 400, y: 200 } },
    { id: 'y', type: 'database', title: 'Orders DB', position: { x: 0, y: 200 } },
  ],
  edges: [
    { id: 'ab', from: 'a', to: 'b', label: 'HTTPS' },
    { id: 'bc', from: 'b', to: 'c', label: 'POST /orders' },
    { id: 'cd', from: 'c', to: 'd', label: 'order.created' },
    { id: 'cx', from: 'c', to: 'x', label: 'authorize' },
    { id: 'cy', from: 'c', to: 'y', label: 'INSERT' },
    { id: 'bb', from: 'b', to: 'b', label: 'retry' },
  ],
  features: [
    { id: 'delivery', title: 'Delivery' },
    { id: 'payments', title: 'Payments' },
  ],
  flows: [
    {
      id: 'place',
      title: 'Place order',
      feature: 'delivery',
      steps: [
        { id: 's1', edge: 'ab' },
        { id: 's2', edge: 'bc', condition: 'token.valid' },
      ],
    },
    { id: 'assign', title: 'Assign driver', feature: 'delivery', steps: [] },
    { id: 'loose', title: 'Refund', steps: [{ id: 'r1', edge: 'cy', title: 'Store refund' }] },
  ],
});

/** A flow with a fork after step 2: "a" continues to the bus, "b" is an error path. */
export const branchedFlow: Flow = {
  id: 'pay',
  title: 'Pay',
  feature: 'payments',
  branches: [
    { id: 'ok', label: 'payment ok', condition: 'authorized' },
    { id: 'fail', label: 'payment failed', condition: 'declined', errorPath: true },
  ],
  steps: [
    { id: 'p1', edge: 'ab' },
    { id: 'p2', edge: 'bc' },
    { id: 'p3a', edge: 'cd', branch: 'ok' },
    { id: 'p3b', edge: 'cx', branch: 'fail' },
  ],
};

export const branchedDeck: SododeckFile = { ...flowDeck, flows: [...flowDeck.flows, branchedFlow] };

export function session(patch: Partial<FlowSession> = {}): FlowSession {
  return {
    mode: 'record',
    flowId: null,
    pendingTitle: 'New',
    featureId: null,
    target: { kind: 'main' },
    addingBranch: false,
    recorded: [],
    checkpoint: null,
    invalid: null,
    candidateEdgeId: null,
    confirmingCancel: false,
    branchCheck: 0,
    ...patch,
  };
}

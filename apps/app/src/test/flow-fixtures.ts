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

/**
 * Flow mode fixtures (007): an 8-step "Place order" (steps 2 and 4 share API Gateway → Order
 * Service; step 5 is Order Service → Payment Service), a flow forking after step 3 into
 * "payment ok" and "payment failed" (error path), a one-step flow, an empty flow and a flow with a
 * broken step.
 */
export const playbackDeck: SododeckFile = deckOf({
  nodes: [
    { id: 'a', type: 'client', title: 'Customer App', position: { x: 0, y: 0 } },
    { id: 'b', type: 'service', title: 'API Gateway', position: { x: 200, y: 0 } },
    { id: 'c', type: 'service', title: 'Order Service', position: { x: 400, y: 0 } },
    { id: 'd', type: 'queue', title: 'Event Bus', position: { x: 600, y: 0 } },
    { id: 'x', type: 'service', title: 'Payment Service', position: { x: 400, y: 200 } },
    { id: 'n', type: 'service', title: 'Notification Service', position: { x: 600, y: 200 } },
    { id: 'z', type: 'database', title: 'Audit DB', position: { x: 0, y: 400 } },
  ],
  edges: [
    { id: 'ab', from: 'a', to: 'b', label: 'HTTPS', protocol: 'http' },
    { id: 'bc', from: 'b', to: 'c', label: 'POST /orders' },
    { id: 'cb', from: 'c', to: 'b', label: 'quote' },
    { id: 'cx', from: 'c', to: 'x', label: 'authorize', protocol: 'grpc' },
    { id: 'xc', from: 'x', to: 'c', label: 'authorized' },
    { id: 'cd', from: 'c', to: 'd', label: 'order.created', protocol: 'event' },
    { id: 'dn', from: 'd', to: 'n', label: 'notify' },
    { id: 'xn', from: 'x', to: 'n', label: 'declined' },
    { id: 'na', from: 'n', to: 'a', label: 'push' },
    { id: 'az', from: 'a', to: 'z', label: 'log' },
  ],
  features: [{ id: 'checkout', title: 'Checkout' }],
  flows: [
    {
      id: 'order',
      title: 'Place order',
      feature: 'checkout',
      steps: [
        { id: 'o1', edge: 'ab', title: 'Submit order' },
        { id: 'o2', edge: 'bc' },
        { id: 'o3', edge: 'cb', title: 'Quote price' },
        { id: 'o4', edge: 'bc', condition: 'quote.ok', description: 'Create the order.' },
        { id: 'o5', edge: 'cx', sla: '< 300 ms', rules: ['limits', 'r9'] },
        { id: 'o6', edge: 'xc' },
        { id: 'o7', edge: 'cd' },
        { id: 'o8', edge: 'dn' },
      ],
    },
    {
      id: 'fork',
      title: 'Checkout',
      feature: 'checkout',
      branches: [
        { id: 'ok', label: 'payment ok', condition: 'authorized' },
        { id: 'failed', label: 'payment failed', condition: 'declined', errorPath: true },
      ],
      steps: [
        { id: 'f1', edge: 'ab' },
        { id: 'f2', edge: 'bc' },
        { id: 'f3', edge: 'cx' },
        { id: 'f4a', edge: 'xc', branch: 'ok' },
        { id: 'f5a', edge: 'cd', branch: 'ok' },
        { id: 'f4b', edge: 'xn', branch: 'failed' },
        { id: 'f5b', edge: 'na', branch: 'failed' },
      ],
    },
    { id: 'one', title: 'Log', feature: 'checkout', steps: [{ id: 'l1', edge: 'az' }] },
    { id: 'empty', title: 'Refund', feature: 'checkout', steps: [] },
    {
      id: 'broken',
      title: 'Track',
      feature: 'checkout',
      steps: [
        { id: 'k1', edge: 'ab' },
        { id: 'k2', edge: 'gone' },
        { id: 'k3', edge: 'bc' },
      ],
    },
  ],
  rules: {
    limits: {
      title: 'Payment limits',
      hitPolicy: 'first',
      inputs: [{ id: 'amount', label: 'Amount' }],
      outputs: [{ id: 'ok', label: 'OK' }],
      rows: [],
    },
  },
});

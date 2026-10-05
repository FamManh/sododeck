import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';

/** One node ("n") used by 2 edges, a step, a view, a sticky and a child node (US3 independent test). */
export const cascadeDeck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'a', type: 'client', title: 'A', group: 'inner' },
    { id: 'n', type: 'service', title: 'N', group: 'inner', rules: ['R'] },
    {
      id: 'child',
      type: 'service',
      title: 'Child',
      parent: 'n',
      group: 'outer',
      rules: ['R', 'Q'],
    },
  ],
  groups: [
    { id: 'outer', title: 'Outer' },
    { id: 'inner', title: 'Inner', parent: 'outer' },
    { id: 'nested', title: 'Nested', parent: 'inner' },
    { id: 'loose', title: 'Loose' },
  ],
  edges: [
    { id: 'e1', from: 'a', to: 'n', label: 'call' },
    { id: 'e2', from: 'n', to: 'a' },
    { id: 'e3', from: 'a', to: 'child' },
  ],
  views: [
    {
      id: 'v',
      type: 'feature',
      title: 'V',
      feature: 'feat',
      includes: ['a', 'n', 'child'],
      positions: { n: { x: 1, y: 1 }, a: { x: 2, y: 2 } },
    },
  ],
  features: [{ id: 'feat', title: 'Checkout' }],
  flows: [
    {
      id: 'fl',
      title: 'Flow',
      feature: 'feat',
      steps: [
        {
          id: 's1',
          edge: 'e1',
          title: 'Call',
          sla: '< 1 s',
          rules: ['R'],
          ruleInputs: { R: { in1: '3' } },
        },
        { id: 's2', edge: 'e3', rules: ['R', 'Q'], ruleInputs: { R: { in1: '1' }, Q: {} } },
      ],
    },
  ],
  rules: {
    R: {
      title: 'R',
      hitPolicy: 'first',
      inputs: [{ id: 'in1', label: 'In' }],
      outputs: [{ id: 'out1', label: 'Out' }],
      rows: [{ id: 'r1', when: ['> 1'], then: ['x'] }],
    },
    Q: { title: 'Q', hitPolicy: 'first', inputs: [], outputs: [], rows: [] },
  },
  stickies: [
    { id: 'st-n', text: 'Near n', position: { x: 220, y: -10 } },
    { id: 'st-e', text: 'Near e1', position: { x: 0, y: 40 } },
    { id: 'st-fl', text: 'About the flow', position: { x: 0, y: 80 } },
    { id: 'st-s1', text: 'About a step', position: { x: 0, y: 120 } },
    { id: 'st-free', text: 'Free', position: { x: 5, y: 5 } },
  ],
};

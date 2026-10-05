import { describe, expect, it } from 'vitest';

import { prepare } from './detect';
import { MermaidImportError } from './import-report';
import { parseFlowchart } from './parse-flowchart';

const parse = (text: string) => parseFlowchart(prepare(text));
const body = (lines: string[], head = 'flowchart LR') => parse([head, ...lines].join('\n'));
const labels = (text: string) => body([text]).nodes.map((n) => [n.key, n.label, n.shape]);

describe('direction', () => {
  it.each([
    ['flowchart TD', 'TB'],
    ['flowchart TB', 'TB'],
    ['flowchart BT', 'BT'],
    ['flowchart LR', 'LR'],
    ['flowchart RL', 'RL'],
    ['flowchart', 'TB'],
    ['graph LR', 'LR'],
    ['graph', 'TB'],
    ['graph TD;', 'TB'],
  ])('%s → %s', (head, direction) => {
    expect(body([], head).direction).toBe(direction);
  });
});

describe('nodes', () => {
  it.each([
    ['A', [['A', 'A', 'bare']]],
    ['A[Web app]', [['A', 'Web app', 'rect']]],
    ['A(API)', [['A', 'API', 'round']]],
    ['A([Start])', [['A', 'Start', 'stadium']]],
    ['A[[Sub]]', [['A', 'Sub', 'subroutine']]],
    ['A[(Users)]', [['A', 'Users', 'cylinder']]],
    ['A((Hub))', [['A', 'Hub', 'circle']]],
    ['A(((Core)))', [['A', 'Core', 'double-circle']]],
    ['A>Note]', [['A', 'Note', 'asymmetric']]],
    ['A{Valid?}', [['A', 'Valid?', 'rhombus']]],
    ['A{{Prep}}', [['A', 'Prep', 'hexagon']]],
    ['A[/In/]', [['A', 'In', 'parallelogram']]],
    ['A[\\Out\\]', [['A', 'Out', 'parallelogram']]],
    ['A[/Trap\\]', [['A', 'Trap', 'trapezoid']]],
    ['A[\\Trap/]', [['A', 'Trap', 'trapezoid']]],
    ['A["quoted (x) label"]', [['A', 'quoted (x) label', 'rect']]],
    ['A[line one<br/>line two]', [['A', 'line one\nline two', 'rect']]],
    ['A[R&amp;D]', [['A', 'R&D', 'rect']]],
    ['A[/api/users]', [['A', '/api/users', 'rect']]],
    ['api-gw[Gateway]', [['api-gw', 'Gateway', 'rect']]],
    ['A[Pay 💳]', [['A', 'Pay 💳', 'rect']]],
  ] as [string, unknown][])('%s', (text, expected) => {
    expect(labels(text)).toEqual(expected);
  });

  it('keeps the first explicit label and shape when a node is declared again', () => {
    const { nodes } = body(['A[First]', 'A{Second}', 'A --> B']);
    expect(nodes.map((n) => [n.key, n.label, n.shape])).toEqual([
      ['A', 'First', 'rect'],
      ['B', 'B', 'bare'],
    ]);
  });

  it('lets a labelled declaration after a link-only mention set the label', () => {
    const { nodes } = body(['A --> B', 'B[Billing]']);
    expect(nodes.find((n) => n.key === 'B')).toMatchObject({ label: 'Billing', shape: 'rect' });
  });

  it('creates nodes that only appear in links, titled by their id', () => {
    expect(body(['X --> Y']).nodes.map((n) => [n.key, n.label])).toEqual([
      ['X', 'X'],
      ['Y', 'Y'],
    ]);
  });

  it('records the line each node was first seen on', () => {
    expect(body(['A[a]', '', 'B[b]']).nodes.map((n) => n.line)).toEqual([2, 4]);
  });
});

describe('links', () => {
  const only = (text: string) => body([text]).links[0];
  it.each([
    ['A --> B', 'normal', 'solid', 'normal'],
    ['A ---> B', 'normal', 'solid', 'normal'],
    ['A --- B', 'none', 'solid', 'normal'],
    ['A -.-> B', 'normal', 'dotted', 'normal'],
    ['A -.- B', 'none', 'dotted', 'normal'],
    ['A ==> B', 'normal', 'solid', 'thick'],
    ['A === B', 'none', 'solid', 'thick'],
    ['A <--> B', 'both', 'solid', 'normal'],
    ['A --o B', 'normal', 'solid', 'normal'],
    ['A --x B', 'normal', 'solid', 'normal'],
    ['A-->B', 'normal', 'solid', 'normal'],
  ] as const)('%s', (text, arrow, dash, width) => {
    expect(only(text)).toMatchObject({ from: 'A', to: 'B', arrow, dash, width });
    expect(only(text)?.label).toBeUndefined();
  });

  it.each([
    ['A -->|yes| B', 'yes'],
    ['A -- yes --> B', 'yes'],
    ['A -- not so --- B', 'not so'],
    ['A -. maybe .-> B', 'maybe'],
    ['A == big ==> B', 'big'],
    ['A -->|"quoted label"| B', 'quoted label'],
    ['A --x B', undefined],
  ])('label of %s', (text, label) => {
    expect(only(text)?.label).toBe(label);
  });

  it('expands chains into one link per pair', () => {
    const { links } = body(['A --> B --> C']);
    expect(links.map((l) => [l.from, l.to])).toEqual([
      ['A', 'B'],
      ['B', 'C'],
    ]);
  });

  it('expands & groups into every pair', () => {
    const { links, nodes } = body(['A & B --> C & D']);
    expect(links.map((l) => `${l.from}${l.to}`)).toEqual(['AC', 'AD', 'BC', 'BD']);
    expect(nodes).toHaveLength(4);
  });

  it('keeps a self link', () => {
    expect(only('A --> A')).toMatchObject({ from: 'A', to: 'A' });
  });

  it('splits statements on semicolons but not inside entities or quotes', () => {
    const result = body(['A[R&amp;D] --> B; B --> C', 'D["x;y"]']);
    expect(result.links).toHaveLength(2);
    expect(result.nodes.map((n) => n.label)).toEqual(['R&D', 'B', 'C', 'x;y']);
  });

  it('records link lines', () => {
    expect(body(['A --> B', 'B --> C']).links.map((l) => l.line)).toEqual([2, 3]);
  });
});

describe('subgraphs', () => {
  it('nests and fills groups with the innermost subgraph', () => {
    const result = body([
      'subgraph outer [Outer title]',
      '  A',
      '  subgraph inner',
      '    B',
      '  end',
      '  C',
      'end',
      'D',
    ]);
    expect(result.subgraphs).toEqual([
      { key: 'outer', label: 'Outer title', members: ['A', 'C'] },
      { key: 'inner', label: 'inner', parent: 'outer', members: ['B'] },
    ]);
    expect(result.groupOf).toEqual({ A: 'outer', B: 'inner', C: 'outer' });
  });

  it.each([
    ['subgraph one', 'one', 'one'],
    ['subgraph one [Title here]', 'one', 'Title here'],
    ['subgraph one["Quoted title"]', 'one', 'Quoted title'],
    ['subgraph Payment services', 'Payment services', 'Payment services'],
  ])('%s', (line, key, label) => {
    expect(body([line, 'end']).subgraphs).toEqual([{ key, label, members: [] }]);
  });

  it('keeps the first group of a node seen outside and later inside', () => {
    const result = body(['A', 'subgraph g', 'A', 'B', 'end']);
    expect(result.groupOf).toEqual({ B: 'g' });
  });

  it('treats a link to a subgraph id as a link to the group, not a component', () => {
    const result = body(['subgraph g [Group]', 'A', 'end', 'X --> g']);
    expect(result.nodes.map((n) => n.key)).toEqual(['A', 'X']);
    expect(result.links).toEqual([expect.objectContaining({ from: 'X', to: 'g' })]);
  });

  it('skips direction inside a subgraph', () => {
    const result = body(['subgraph g', 'direction TB', 'A', 'end']);
    expect(result.skipped).toEqual([expect.objectContaining({ line: 3, reason: 'unsupported' })]);
  });
});

describe('skipped lines', () => {
  it.each([
    ['style A fill:#f9f', 'appearance'],
    ['classDef big fill:#f00', 'appearance'],
    ['class A big', 'appearance'],
    ['linkStyle 0 stroke:#f00', 'appearance'],
    ['accTitle: a title', 'appearance'],
    ['click A callback "tip"', 'interaction'],
    ['click A href "https://example.com"', 'interaction'],
    ['A ~~~ B', 'unsupported'],
    ['this is not mermaid at all ???', 'unreadable'],
    ['A -->', 'unreadable'],
    ['A[unclosed --> B', 'unreadable'],
    ['end', 'unreadable'],
  ])('%s → %s', (line, reason) => {
    const result = body(['A', line]);
    expect(result.skipped).toEqual([{ line: 3, text: line, reason }]);
  });

  it('keeps the node but reports a :::class suffix as appearance', () => {
    const result = body(['A[Web]:::big --> B']);
    expect(result.nodes.map((n) => n.label)).toEqual(['Web', 'B']);
    expect(result.links).toHaveLength(1);
    expect(result.skipped).toEqual([expect.objectContaining({ line: 2, reason: 'appearance' })]);
  });

  it('keeps a node with @{ } metadata as a rectangle and reports it', () => {
    const result = body(['A@{ shape: cloud }']);
    expect(result.nodes.map((n) => [n.key, n.label, n.shape])).toEqual([['A', 'A', 'bare']]);
    expect(result.skipped).toEqual([expect.objectContaining({ reason: 'unsupported' })]);
  });

  it('does not create nodes from an unreadable line', () => {
    expect(body(['A --> B -->']).nodes).toEqual([]);
  });

  it('reports lines at their original numbers with Windows line endings', () => {
    const result = parse('flowchart LR\r\n  A --> B\r\n  style A fill:#fff\r\n');
    expect(result.skipped).toEqual([{ line: 3, text: 'style A fill:#fff', reason: 'appearance' }]);
  });

  it('carries extra-diagram reports from preparation', () => {
    const text = '```mermaid\nflowchart LR\nA-->B\n```\n```mermaid\nerDiagram\nA ||--o{ B : x\n```';
    expect(parse(text).skipped).toEqual([expect.objectContaining({ reason: 'extra-diagram' })]);
  });
});

describe('front matter and limits', () => {
  it('keeps the title from front matter', () => {
    expect(parse('---\ntitle: My flow\n---\nflowchart LR\nA-->B').title).toBe('My flow');
  });

  it('refuses more than 2,000 nodes', () => {
    const lines = Array.from({ length: 2001 }, (_, i) => `N${i}`);
    expect(() => body(lines)).toThrow(MermaidImportError);
    expect(() => body(lines)).toThrow(/too-large/);
  });

  it('refuses more than 4,000 links', () => {
    const lines = Array.from({ length: 4001 }, () => 'A --> B');
    expect(() => body(lines)).toThrow(/too-large/);
  });
});

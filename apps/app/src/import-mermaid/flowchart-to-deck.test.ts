import { fromJSON, NEW_DECK_PACKS, toJSON } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { prepare } from './detect';
import { flowchartToDeck } from './flowchart-to-deck';
import { parseFlowchart } from './parse-flowchart';

const QUICKSTART = `flowchart LR
  subgraph Client
    W[Web app] -->|login| A(API)
  end
  A --> D{Valid?}
  D -- yes --> DB[(Users)]
  D -- no --> W
  style W fill:#fff`;

const build = (text: string) => flowchartToDeck(parseFlowchart(prepare(text)));

describe('flowchartToDeck', () => {
  it('maps the quickstart flowchart', () => {
    const { file, report } = build(QUICKSTART);
    expect(file.nodes.map((n) => [n.title, n.type])).toEqual([
      ['Web app', 'rectangle'],
      ['API', 'rounded-rectangle'],
      ['Valid?', 'diamond'],
      ['Users', 'cylinder'],
    ]);
    expect(file.edges.map((e) => e.label)).toEqual(['login', undefined, 'yes', 'no']);
    expect(file.groups).toHaveLength(1);
    expect(file.groups[0]?.title).toBe('Client');
    const members = file.nodes.filter((n) => n.group === file.groups[0]?.id);
    expect(members.map((n) => n.title)).toEqual(['Web app', 'API']);
    expect(report.counts).toEqual({ components: 4, connections: 4, groups: 1, steps: 0 });
    expect(report.skipped).toEqual([expect.objectContaining({ reason: 'appearance' })]);
  });

  it('names the deck after the title, else "Imported diagram", and turns the shapes pack on', () => {
    expect(build('flowchart LR\nA-->B').file.name).toBe('Imported diagram');
    expect(build('---\ntitle: Checkout\n---\nflowchart LR\nA-->B').file.name).toBe('Checkout');
    const packs = build('flowchart LR\nA-->B').file.packs;
    expect(packs).toEqual([...NEW_DECK_PACKS]);
    expect(packs).toContain('shapes');
  });

  it('sets sizes from the registry', () => {
    expect(build('flowchart LR\nA{x}').file.nodes[0]?.size).toEqual({ width: 176, height: 112 });
  });

  it('encodes link kinds as direction and style', () => {
    const { file } = build('flowchart LR\nA --- B\nA <--> B\nA -.-> B\nA ==> B\nA --> B');
    expect(file.edges.map((e) => [e.direction, e.style])).toEqual([
      ['none', undefined],
      ['both', undefined],
      [undefined, { dash: 'dotted' }],
      [undefined, { width: 3 }],
      [undefined, undefined],
    ]);
  });

  it('keeps self links', () => {
    const { file } = build('flowchart LR\nA --> A');
    expect(file.edges[0]?.from).toBe(file.edges[0]?.to);
  });

  it('connects to a group frame when a link ends on a subgraph', () => {
    const { file } = build('flowchart LR\nsubgraph g [G]\nA\nend\nX --> g');
    expect(file.edges[0]?.to).toBe(file.groups[0]?.id);
  });

  it('nests groups through parent ids', () => {
    const { file } = build('flowchart LR\nsubgraph o\nsubgraph i\nA\nend\nend');
    const [outer, inner] = file.groups;
    expect(inner?.parent).toBe(outer?.id);
    expect(outer?.parent).toBeUndefined();
  });

  it('generates ids that equal no Mermaid key or title, and are unique', () => {
    const { file } = build(QUICKSTART);
    const all = [...file.nodes, ...file.groups, ...file.edges].map((o) => o.id);
    expect(new Set(all).size).toBe(all.length);
    const forbidden = ['W', 'A', 'D', 'DB', 'Client', 'Web app', 'API'];
    for (const id of all) expect(forbidden).not.toContain(id);
  });

  it('gives the same structure and titles when run twice, with different ids', () => {
    const a = build(QUICKSTART).file;
    const b = build(QUICKSTART).file;
    expect(a.nodes.map((n) => n.title)).toEqual(b.nodes.map((n) => n.title));
    expect(a.edges.map((e) => e.label)).toEqual(b.edges.map((e) => e.label));
    expect(a.nodes[0]?.id).not.toBe(b.nodes[0]?.id);
  });

  it('is a valid deck that round-trips through the model', () => {
    const { file } = build(QUICKSTART);
    const doc = fromJSON(file);
    const back = toJSON(doc);
    expect(toJSON(fromJSON(back))).toEqual(back);
    expect(back.nodes.map((n) => n.title)).toEqual(file.nodes.map((n) => n.title));
    expect(back.edges).toHaveLength(file.edges.length);
  });

  it('keeps markup out of titles (FR-019)', () => {
    const { file } = build(
      'flowchart LR\nA["<img src=x onerror=alert(1)>Hi"] --> B[<script>x</script>]',
    );
    expect(file.nodes.map((n) => n.title)).toEqual(['Hi', 'x']);
    for (const node of file.nodes) expect(node.title).not.toMatch(/[<>]/);
  });
});

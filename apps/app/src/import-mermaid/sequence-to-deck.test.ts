import { analyzeFlow, checkIntegrity, fromJSON, toJSON } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { COMPONENT_CARD_SIZE } from '../editor/canvas-geometry';
import { prepare } from './detect';
import { parseSequence } from './parse-sequence';
import { COMPONENT_WIDTH, ROW_GAP, sequenceToDeck } from './sequence-to-deck';

const build = (...lines: string[]) =>
  sequenceToDeck(parseSequence(prepare(['sequenceDiagram', ...lines].join('\n'))));

const TEN = [
  'title Checkout',
  'actor User',
  'participant Web',
  'participant API',
  'participant DB as Database',
  'User->>Web: open cart',
  'Web->>API: POST /cart',
  'API->>DB: insert',
  'DB-->>API: ok',
  'API-->>Web: 201',
  'Web-->>User: confirmation',
  'User->>Web: pay',
  'Web->>API: POST /pay',
  'API-->>Web: paid',
  'Web-->>User: receipt',
];

describe('sequenceToDeck', () => {
  it('maps 4 participants and 10 messages to components, one flow and steps in order', () => {
    const { file, report } = build(...TEN);
    expect(file.name).toBe('Checkout');
    expect(file.nodes.map((n) => [n.title, n.type])).toEqual([
      ['User', 'actor'],
      ['Web', 'component'],
      ['API', 'component'],
      ['Database', 'component'],
    ]);
    expect(file.flows).toHaveLength(1);
    const [flow] = file.flows;
    expect(flow?.title).toBe('Checkout');
    expect(flow?.steps.map((s) => s.title)).toEqual([
      'open cart',
      'POST /cart',
      'insert',
      'ok',
      '201',
      'confirmation',
      'pay',
      'POST /pay',
      'paid',
      'receipt',
    ]);
    const edgeIds = new Set(file.edges.map((e) => e.id));
    for (const step of flow?.steps ?? []) expect(edgeIds.has(step.edge)).toBe(true);
    expect(report).toMatchObject({
      kind: 'sequence',
      counts: { components: 4, connections: 6, groups: 0, steps: 10 },
      notes: [],
    });
  });

  it('reuses one edge per ordered pair', () => {
    const { file } = build('A->>B: 1', 'B->>A: 2', 'A->>B: 3');
    expect(file.edges).toHaveLength(2);
    const [flow] = file.flows;
    expect(flow?.steps[0]?.edge).toBe(flow?.steps[2]?.edge);
    expect(flow?.steps[0]?.edge).not.toBe(flow?.steps[1]?.edge);
  });

  it('labels an edge only when all its messages share the label, and dashes it only when all are dashed', () => {
    const { file } = build(
      'A->>B: same',
      'A->>B: same',
      'B-->>A: x',
      'B->>A: y',
      'A-->>C: d',
      'A-->>C: d',
    );
    const byPair = file.edges.map((e) => [e.label, e.style?.dash]);
    expect(byPair).toEqual([
      ['same', undefined],
      [undefined, undefined],
      ['d', 'dashed'],
    ]);
  });

  it('falls back to "<from> → <to>" for a message without text', () => {
    const { file } = build('participant W as Web', 'W->>API');
    expect(file.flows[0]?.steps[0]?.title).toBe('Web → API');
    expect(file.edges[0]?.label).toBeUndefined();
  });

  it('puts the block label in the first covered step notes and says branching was flattened', () => {
    const { file, report } = build('A->>B: a', 'alt paid', 'B->>A: ok', 'B->>A: more', 'end');
    expect(file.flows[0]?.steps.map((s) => s.notes)).toEqual([undefined, 'alt: paid', undefined]);
    expect(report.notes).toEqual(['Branching in sequence blocks was flattened']);
    expect(report.skipped.some((s) => s.reason === 'flattened')).toBe(true);
  });

  it('names the flow "Imported sequence" and the deck "Imported diagram" without a title', () => {
    const { file } = build('A->>B: x');
    expect(file.name).toBe('Imported diagram');
    expect(file.flows[0]?.title).toBe('Imported sequence');
  });

  it('lays participants in a row, in order of appearance, 80 px apart at y = 0', () => {
    expect(COMPONENT_WIDTH).toBe(COMPONENT_CARD_SIZE.width);
    expect(ROW_GAP).toBe(80);
    const { file } = build('actor U', 'U->>W: a', 'W->>A: b');
    const xs = file.nodes.map((n) => n.position?.x);
    expect(xs).toEqual([0, 80 + 80, 80 + 80 + 184 + 80]);
    for (const node of file.nodes) expect(node.position?.y).toBe(0);
  });

  it('is a valid deck that round-trips', () => {
    const { file } = build(...TEN);
    const back = toJSON(fromJSON(file));
    expect(toJSON(fromJSON(back))).toEqual(back);
    expect(back.flows[0]?.steps).toHaveLength(10);
  });

  it('produces a flow the model finds sound when the messages chain', () => {
    const { file } = build('A->>B: 1', 'B->>C: 2', 'C-->>B: 3', 'B-->>A: 4');
    expect(checkIntegrity(file)).toEqual([]);
    const [flow] = file.flows;
    const analysis = analyzeFlow(flow ?? { id: 'x', title: 'x', steps: [] }, file.edges);
    expect(analysis.problems).toEqual([]);
    expect(analysis.canFinish).toBe(true);
  });

  it('uses generated ids, never Mermaid keys', () => {
    const { file } = build('Alice->>Bob: hi');
    const ids = [...file.nodes, ...file.edges].map((o) => o.id);
    for (const id of ids) expect(['Alice', 'Bob']).not.toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

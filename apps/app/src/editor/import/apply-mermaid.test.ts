import { createEditor, fromJSON, serializeDeck, toJSON } from '@sododeck/model';
import { emptySododeckFile, type Node, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { importMermaid } from '../../storage/library-ops';
import { applyMermaid, IMPORT_GAP, MermaidApplyError, mermaidOffset } from './apply-mermaid';
import { existingRects } from './import-target';

const EXISTING: Node[] = [
  { id: 'a', type: 'component', title: 'Gateway', position: { x: 0, y: 40 } },
  { id: 'b', type: 'component', title: 'Billing', position: { x: 300, y: 200 } },
];

function deckWith(nodes: Node[] = EXISTING) {
  const doc = fromJSON({
    ...emptySododeckFile(),
    name: 'Deck',
    nodes,
    edges: nodes.length > 1 ? [{ id: 'ab', from: 'a', to: 'b' }] : [],
  });
  return { doc, editor: createEditor(doc) };
}

/** A sequence diagram comes back placed: two cards, two connectors and one flow. */
const sequence = () => importMermaid('sequenceDiagram\n  A->>B: hi\n  B-->>A: ok').file;

/** A placed flowchart with a group, whose ids collide on purpose with the deck's. */
function collidingFlowchart(): SododeckFile {
  const { file } = importMermaid('flowchart LR\n  subgraph G\n    X[Web] --> Y(API)\n  end');
  const rename = new Map<string, string>([
    [file.nodes[0]?.id ?? '', 'a'],
    [file.nodes[1]?.id ?? '', 'b'],
    [file.edges[0]?.id ?? '', 'ab'],
  ]);
  const to = (id: string) => rename.get(id) ?? id;
  return {
    ...file,
    nodes: file.nodes.map((n, i) => ({ ...n, id: to(n.id), position: { x: i * 260, y: 0 } })),
    edges: file.edges.map((e) => ({ ...e, id: to(e.id), from: to(e.from), to: to(e.to) })),
  };
}

describe('applyMermaid', () => {
  it('adds the cards, connectors and flow in one undo step', () => {
    const { doc, editor } = deckWith();
    const before = toJSON(doc);
    const applied = applyMermaid(editor, sequence(), { existing: existingRects(before) });
    const after = toJSON(doc);
    expect(after.nodes).toHaveLength(4);
    expect(after.edges).toHaveLength(3);
    expect(after.flows).toHaveLength(1);
    expect(applied.flows).toHaveLength(1);
    // The flow's steps follow the new connectors.
    const steps = after.flows[0]?.steps ?? [];
    expect(steps.map((s) => s.title)).toEqual(['hi', 'ok']);
    for (const step of steps) expect(applied.edges).toContain(step.edge);
    expect(after.name).toBe('Deck');

    editor.undo();
    expect(toJSON(doc)).toEqual(before);
  });

  it('gives every object a fresh id, even when the diagram reuses the deck’s ids', () => {
    const { doc, editor } = deckWith();
    const applied = applyMermaid(editor, collidingFlowchart(), {
      existing: existingRects(toJSON(doc)),
    });
    const ids = [...applied.nodes, ...applied.edges, ...applied.groups];
    expect(ids).not.toContain('a');
    expect(ids).not.toContain('b');
    expect(ids).not.toContain('ab');
    const after = toJSON(doc);
    const all = [...after.nodes, ...after.edges, ...after.groups].map((o) => o.id);
    expect(new Set(all).size).toBe(all.length);
    // The imported connector joins the imported cards, not the deck's own.
    const edge = after.edges.find((e) => e.id === applied.edges[0]);
    expect(applied.nodes).toContain(edge?.from);
    expect(applied.nodes).toContain(edge?.to);
    // The cards stay in their imported group.
    for (const id of applied.nodes) {
      expect(after.nodes.find((n) => n.id === id)?.group).toBe(applied.groups[0]);
    }
  });

  it('places the cluster right of the existing content, top edges aligned', () => {
    const { doc, editor } = deckWith();
    const existing = existingRects(toJSON(doc));
    const right = Math.max(...existing.map((r) => r.x + r.width));
    const applied = applyMermaid(editor, sequence(), { existing });
    const placed = toJSON(doc).nodes.filter((n) => applied.nodes.includes(n.id));
    const xs = placed.map((n) => n.position?.x ?? -Infinity);
    const ys = placed.map((n) => n.position?.y ?? -Infinity);
    expect(Math.min(...xs)).toBe(right + IMPORT_GAP);
    expect(Math.min(...ys)).toBe(40);
  });

  it('keeps the layout’s own positions in an empty deck', () => {
    const { doc, editor } = deckWith([]);
    const file = sequence();
    applyMermaid(editor, file, { existing: [] });
    expect(toJSON(doc).nodes.map((n) => n.position)).toEqual(file.nodes.map((n) => n.position));
    expect(mermaidOffset({ sododeckFragment: 1, deck: file }, [])).toEqual({ x: 0, y: 0 });
  });

  it('round-trips the result through the file format', () => {
    const { doc, editor } = deckWith();
    applyMermaid(editor, collidingFlowchart(), { existing: existingRects(toJSON(doc)) });
    applyMermaid(editor, sequence(), { existing: existingRects(toJSON(doc)) });
    const file = toJSON(doc);
    expect(toJSON(fromJSON(JSON.parse(serializeDeck(file)) as unknown))).toEqual(file);
  });

  it('refuses an invalid file and writes nothing', () => {
    const { doc, editor } = deckWith();
    const before = toJSON(doc);
    const broken: SododeckFile = {
      ...sequence(),
      nodes: [{ id: 'x', type: 'component', title: '' }],
    };
    expect(() => applyMermaid(editor, broken, { existing: [] })).toThrow(MermaidApplyError);
    expect(toJSON(doc)).toEqual(before);
  });
});

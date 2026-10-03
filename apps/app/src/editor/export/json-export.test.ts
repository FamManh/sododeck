import { readFileSync } from 'node:fs';

import { fromJSON, serializeDeck, toJSON } from '@sododeck/model';
import { emptySododeckFile, parseSododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { generateBenchDeck } from '../../bench/generate-deck';
import { demoDeck } from '../demo-deck';
import { jsonExport, withoutKnowledge } from './json-export';

function example(file: string): SododeckFile {
  const url = new URL(import.meta.resolve(`@sododeck/schema/examples/${file}`));
  return JSON.parse(readFileSync(url, 'utf8')) as SododeckFile;
}

/** A generated deck with descriptions, links and rules on every kind of object. */
function knowledgeDeck(): SododeckFile {
  const deck = generateBenchDeck(60, 90, 7, {
    flows: true,
    groups: true,
    stickies: 4,
    views: true,
  }).deck;
  const links = [{ url: 'https://example.com/runbook', label: 'Runbook' }];
  return {
    ...deck,
    description: 'Deck **description**',
    rules: {
      r1: { title: 'Decision', hitPolicy: 'first', inputs: [], outputs: [], rows: [] },
    },
    nodes: deck.nodes.map((node, index) =>
      index % 3 === 0 ? { ...node, description: 'Node', links, rules: ['r1'] } : node,
    ),
    groups: deck.groups.map((group) => ({ ...group, description: 'Group' })),
    edges: deck.edges.map((edge, index) =>
      index % 4 === 0 ? { ...edge, description: 'Edge', links } : edge,
    ),
    flows: deck.flows.map((flow) => ({
      ...flow,
      description: 'Flow',
      links,
      steps: flow.steps.map((step) => ({
        ...step,
        description: 'Step',
        links,
        rules: ['r1'],
        ruleInputs: {},
      })),
    })),
  };
}

const decks: [string, SododeckFile][] = [
  ['minimal example', example('minimal.sododeck.json')],
  ['flow-and-rule example', example('flow-and-rule.sododeck.json')],
  ['full example', example('full.sododeck.json')],
  ['demo deck', demoDeck],
  ['generated deck with knowledge', knowledgeDeck()],
];

describe('jsonExport', () => {
  it.each(decks)('%s: default options equal the backup export and round-trip', (_, deck) => {
    const { text, bytes } = jsonExport(deck, { includeKnowledge: true, pretty: true });
    expect(text).toBe(serializeDeck(deck));
    expect(bytes).toBe(new TextEncoder().encode(text).byteLength);
    expect(toJSON(fromJSON(JSON.parse(text) as SododeckFile))).toEqual(toJSON(fromJSON(deck)));
  });

  it.each(decks)('%s: compact JSON has no indentation and the same content', (_, deck) => {
    const compact = jsonExport(deck, { includeKnowledge: true, pretty: false });
    expect(compact.text).not.toMatch(/\n\s/);
    expect(JSON.parse(compact.text)).toEqual(JSON.parse(serializeDeck(deck)));
    expect(compact.bytes).toBeLessThan(
      jsonExport(deck, { includeKnowledge: true, pretty: true }).bytes,
    );
  });

  it.each(decks)('%s: without knowledge is still a valid file', (_, deck) => {
    const { text } = jsonExport(deck, { includeKnowledge: false, pretty: true });
    const parsed = parseSododeckFile(JSON.parse(text));
    expect(parsed.success).toBe(true);
    expect(text).not.toMatch(/"(description|links|ruleInputs)":/);
    expect(text).not.toMatch(/"rules": \[/);
  });
});

describe('withoutKnowledge', () => {
  it('removes descriptions, links and rules and keeps everything else', () => {
    const deck = knowledgeDeck();
    const original = structuredClone(deck);
    const stripped = withoutKnowledge(deck);
    expect(deck).toEqual(original);
    expect(stripped.description).toBeUndefined();
    expect(stripped.rules).toEqual({});
    expect(stripped.nodes.some((node) => 'description' in node || 'links' in node)).toBe(false);
    expect(stripped.nodes.some((node) => 'rules' in node)).toBe(false);
    expect(stripped.flows.flatMap((flow) => flow.steps).some((step) => 'rules' in step)).toBe(
      false,
    );
    expect(stripped.nodes.map((node) => node.id)).toEqual(deck.nodes.map((node) => node.id));
    expect(stripped.edges.map((edge) => edge.id)).toEqual(deck.edges.map((edge) => edge.id));
    expect(stripped.stickies).toEqual(deck.stickies);
    expect(stripped.views).toEqual(deck.views);
  });

  it('leaves an empty deck valid', () => {
    expect(parseSododeckFile(withoutKnowledge(emptySododeckFile())).success).toBe(true);
  });
});

describe('tag colours in the JSON export (033)', () => {
  const coloured: SododeckFile = {
    ...emptySododeckFile(),
    swatches: ['#7a3cff'],
    tagColors: { Lan: '#7a3cff', PCI: 'violet' },
    nodes: [{ id: 'a', type: 'service', title: 'A', tags: ['PCI', 'Lan'] }],
  };

  it.each([true, false])(
    'keeps tagColors after swatches (includeKnowledge %s)',
    (includeKnowledge) => {
      const { text } = jsonExport(coloured, { includeKnowledge, pretty: true });
      const parsed = JSON.parse(text) as SododeckFile;
      expect(parsed.tagColors).toEqual({ Lan: '#7a3cff', PCI: 'violet' });
      const keys = Object.keys(parsed);
      expect(keys.indexOf('tagColors')).toBe(keys.indexOf('swatches') + 1);
    },
  );

  it('is accepted again by the importer (schema and model)', () => {
    const { text } = jsonExport(coloured, { includeKnowledge: true, pretty: true });
    const result = parseSododeckFile(JSON.parse(text));
    expect(result.success).toBe(true);
    expect(toJSON(fromJSON(JSON.parse(text))).tagColors).toEqual(coloured.tagColors);
  });
});

describe('jsonExport keeps connector style compatible (022 SC-004, SC-005)', () => {
  const nodes: SododeckFile['nodes'] = [
    { id: 'a', type: 'client', title: 'A' },
    { id: 'b', type: 'service', title: 'B' },
  ];
  const keysOf = (file: SododeckFile) => JSON.stringify(file);

  it('adds no 022 key to a deck from before 022, even after unrelated edits', () => {
    const old: SododeckFile = {
      ...emptySododeckFile(),
      nodes,
      edges: [
        { id: 'e1', from: 'a', to: 'b', route: { fromSide: 'right', offset: 12 } },
        { id: 'e2', from: 'b', to: 'a', style: { shape: 'straight' } },
        { id: 'e3', from: 'a', to: 'b', label: 'plain' },
      ],
    };
    const { text } = jsonExport(old, { includeKnowledge: true, pretty: true });
    const out = JSON.parse(text) as SododeckFile;
    expect(out.edges).toEqual(old.edges);
    for (const key of [
      'dash',
      'width',
      'color',
      'animated',
      'fromAt',
      'toAt',
      'waypoints',
      'labelAt',
    ]) {
      expect(keysOf(out)).not.toContain(`"${key}"`);
    }
  });

  it('a deck using every 022 key survives export, import and save unchanged', () => {
    const full: SododeckFile = {
      ...emptySododeckFile(),
      nodes,
      edges: [
        {
          id: 'e1',
          from: 'a',
          to: 'b',
          label: 'go',
          labelAt: 0.2,
          route: {
            fromSide: 'right',
            fromAt: 0.25,
            toSide: 'left',
            toAt: 1,
            waypoints: [
              { x: 0.5, dy: -88 },
              { dx: 4, y: 1 },
            ],
          },
          style: { shape: 'elbow', dash: 'dashed', width: 3, color: 'blue', animated: true },
        },
      ],
    };
    const { text } = jsonExport(full, { includeKnowledge: true, pretty: true });
    const parsed = JSON.parse(text) as SododeckFile;
    expect(parseSododeckFile(parsed).success).toBe(true);
    expect(toJSON(fromJSON(parsed)).edges).toEqual(full.edges);
    expect(serializeDeck(toJSON(fromJSON(parsed)))).toBe(serializeDeck(parsed));
  });
});

import { readFile } from 'node:fs/promises';

import { emptySododeckFile, parseSododeckFile, type SododeckFile } from '@sododeck/schema';
import { expect } from 'vitest';
import * as Y from 'yjs';

import { toJSON, type DeckDoc } from '../src';

export async function readExample(file: string): Promise<SododeckFile> {
  const url = new URL(import.meta.resolve(`@sododeck/schema/examples/${file}`));
  return JSON.parse(await readFile(url, 'utf8')) as SododeckFile;
}

/** Deterministic id generator: `node-0`, `edge-1`, … */
export function seqIds(): (prefix: string) => string {
  let n = 0;
  return (prefix) => `${prefix}-${String(n++)}`;
}

/** The deck exports a file that passes format validation (SC-007). */
export function expectValid(doc: DeckDoc): void {
  const result = parseSododeckFile(toJSON(doc));
  expect(result.success ? [] : result.issues).toEqual([]);
}

export interface LargeDeckSize {
  nodes: number;
  edges: number;
  flows: number;
  stepsPerFlow: number;
  rules: number;
  stickies?: number;
}

/** A valid deck with fixed ids, for performance tests (research R10). */
export function largeDeck(
  size: LargeDeckSize = {
    nodes: 500,
    edges: 1000,
    flows: 20,
    stepsPerFlow: 10,
    rules: 10,
    stickies: 0,
  },
): SododeckFile {
  const file = emptySododeckFile();
  for (let i = 0; i < size.nodes; i++) {
    file.nodes.push({
      id: `n${String(i)}`,
      type: 'service',
      title: `Service ${String(i)}`,
      description: 'Handles **things**.',
      tech: 'Go',
      tags: ['core'],
      position: { x: (i % 25) * 200, y: Math.floor(i / 25) * 120 },
    });
  }
  for (let i = 0; i < size.edges; i++) {
    file.edges.push({
      id: `e${String(i)}`,
      from: `n${String(i % size.nodes)}`,
      to: `n${String((i * 7 + 1) % size.nodes)}`,
      protocol: 'http',
      label: `POST /things/${String(i)}`,
    });
  }
  for (let r = 0; r < size.rules; r++) {
    file.rules[`R${String(r)}`] = {
      title: `Rule ${String(r)}`,
      hitPolicy: 'first',
      inputs: [
        { id: 'in1', label: 'Weight' },
        { id: 'in2', label: 'Zone' },
      ],
      outputs: [{ id: 'out1', label: 'Carrier' }],
      rows: [
        { id: 'r1', when: ['< 5', 'EU'], then: ['Post'] },
        { id: 'r2', when: ['', ''], then: ['Truck'] },
      ],
    };
  }
  for (let f = 0; f < size.flows; f++) {
    file.flows.push({
      id: `f${String(f)}`,
      title: `Flow ${String(f)}`,
      steps: Array.from({ length: size.stepsPerFlow }, (_, s) => ({
        id: `f${String(f)}s${String(s)}`,
        edge: `e${String((f * size.stepsPerFlow + s) % size.edges)}`,
        title: `Step ${String(s)}`,
        ...(s === 0
          ? {
              rules: [`R${String(f % size.rules)}`],
              ruleInputs: { [`R${String(f % size.rules)}`]: { in1: '3' } },
            }
          : {}),
      })),
    });
  }
  for (let i = 0; i < (size.stickies ?? 0); i++) {
    const nodeId = `n${String(i % size.nodes)}`;
    file.stickies.push(
      i % 2 === 0
        ? {
            id: `sticky${String(i)}`,
            text: `Bench note ${String(i)} for service ${String(i % size.nodes)}`,
            position: { x: (i % 20) * 120, y: Math.floor(i / 20) * 96 },
          }
        : {
            id: `sticky${String(i)}`,
            text: `Pinned note ${String(i)} for service ${String(i % size.nodes)}`,
            anchor: nodeId,
            position: { x: 24 + (i % 3) * 8, y: -96 + (i % 5) * 12 },
          },
    );
  }
  return file;
}

/** Which sign of the layout used before 036 a hand-built legacy document carries. */
export type LegacySign = 'collection' | 'rule' | 'description';

/**
 * A document in the layout used before 036 (layout 1), built by hand: collections as `Y.Array`,
 * a rule's columns as `Y.Array`, `meta.description` as a string. Only the chosen sign is present.
 */
export function legacyDoc(sign: LegacySign): Y.Doc {
  const doc = new Y.Doc();
  doc.transact(() => {
    const meta = doc.getMap<unknown>('meta');
    meta.set('$schema', 'https://sododeck.com/schema/v1.json');
    meta.set('version', 1);
    if (sign === 'description') meta.set('description', 'An old deck.');
    if (sign === 'collection') {
      const node = new Y.Map<unknown>();
      node.set('id', 'n');
      node.set('type', 'service');
      node.set('title', 'Old');
      doc.getArray('nodes').push([node]);
    }
    if (sign === 'rule') {
      const rule = new Y.Map<unknown>();
      rule.set('title', 'Old rule');
      rule.set('hitPolicy', 'first');
      for (const field of ['inputs', 'outputs', 'rows']) rule.set(field, new Y.Array());
      doc.getMap('rules').set('R', rule);
    }
  });
  return doc;
}

/** A copy of `doc` loaded from its update bytes, as storage would load it. */
export function reload(doc: Y.Doc): Y.Doc {
  const copy = new Y.Doc();
  Y.applyUpdate(copy, Y.encodeStateAsUpdate(doc));
  return copy;
}

import { readFile } from 'node:fs/promises';

import { emptySododeckFile, parseSododeckFile, type SododeckFile } from '@sododeck/schema';
import { expect } from 'vitest';

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

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { SododeckFile } from '@sododeck/schema';

const dir = fileURLToPath(new URL('../examples/', import.meta.url));

export function exampleText(name: string): string {
  return readFileSync(`${dir}${name}`, 'utf8');
}

export function example(name: string): SododeckFile {
  return JSON.parse(exampleText(name)) as SododeckFile;
}

/** A deck file with only the required root keys and the given parts. */
export function deck(parts: Partial<SododeckFile>): SododeckFile {
  return {
    $schema: 'https://sododeck.com/schema/v1.json',
    version: 1,
    nodes: [],
    groups: [],
    edges: [],
    views: [],
    features: [],
    flows: [],
    rules: {},
    stickies: [],
    ...parts,
  };
}

export const text = (file: unknown) => JSON.stringify(file, null, 2);

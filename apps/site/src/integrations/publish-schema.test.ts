// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SCHEMA_PATH, SCHEMA_SOURCE, copySchema } from './publish-schema';

let outDir: string | undefined;

afterEach(async () => {
  if (outDir) await rm(outDir, { recursive: true, force: true });
  outDir = undefined;
});

describe('publishSchema', () => {
  it('publishes the schema at the path of its $id', async () => {
    const source: unknown = JSON.parse(await readFile(SCHEMA_SOURCE, 'utf8'));
    expect(source).toMatchObject({ $id: `https://sododeck.com/${SCHEMA_PATH}` });
  });

  it('copies the schema byte for byte into the build output', async () => {
    outDir = await mkdtemp(join(tmpdir(), 'site-schema-'));
    const target = await copySchema(outDir);

    expect(target).toBe(join(outDir, SCHEMA_PATH));
    expect(await readFile(target, 'utf8')).toBe(await readFile(SCHEMA_SOURCE, 'utf8'));
  });
});

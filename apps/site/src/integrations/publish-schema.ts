import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

/**
 * The deck file format's JSON Schema, copied (not imported) so the site keeps no code dependency
 * on `@sododeck/schema`. Files point at it through `$schema`, so editors can fetch it.
 */
export const SCHEMA_SOURCE = fileURLToPath(
  new URL('../../../../packages/schema/schema/v1.json', import.meta.url),
);

/** Where the schema lands in the built site: `https://sododeck.com/schema/v1.json`. */
export const SCHEMA_PATH = 'schema/v1.json';

export async function copySchema(outDir: string, source = SCHEMA_SOURCE): Promise<string> {
  const target = join(outDir, SCHEMA_PATH);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
  return target;
}

/** Publishes the schema at its `$id` URL when the site is built. */
export function publishSchema(): AstroIntegration {
  return {
    name: 'sododeck:publish-schema',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const target = await copySchema(fileURLToPath(dir));
        logger.info(`schema → ${target}`);
      },
    },
  };
}

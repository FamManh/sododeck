/**
 * Builds the AI deck skill (027 research R1, R2, R7, R8):
 *
 *   pnpm --filter @sododeck/skill build            → dist/sododeck-deck/ and dist/sododeck-deck.zip
 *   tsx scripts/build.ts --out <dir>                → the same into another folder (the drift test)
 *
 * Markdown sources get their facts filled in, the schema and examples are copied, and the scripts
 * are bundled into one self-contained ES module (the app's own load and problem logic included)
 * plus one tiny entry file per command.
 */
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

import { COMMANDS } from '../src/cli/main';
import { fill, placeholders } from '../src/generate';
import { versionStamp } from '../src/version';
import { zip } from './zip';

const root = fileURLToPath(new URL('..', import.meta.url));
const SKILL = 'sododeck-deck';

/** Node modules the bundle must never import: the scripts work offline (FR-005). */
export const NETWORK_MODULES = ['http', 'https', 'net', 'tls', 'dgram', 'http2', 'undici'];

/**
 * A bundled dependency probes `globalThis.localStorage`, which newer Node versions answer with an
 * ExperimentalWarning on stderr. Agents read stderr, so that one warning is dropped; every other
 * warning still prints. Runs before any bundled module code.
 */
const QUIET_LOCAL_STORAGE =
  "{const w=process.emitWarning;process.emitWarning=function(m,...a){if(String(m).includes('localStorage'))return;return w.call(process,m,...a)}}";

async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(path)));
    else out.push(path);
  }
  return out.sort();
}

async function write(path: string, data: string | Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

export async function buildSkill(outRoot: string): Promise<{ folder: string; archive: string }> {
  const folder = join(outRoot, SKILL);
  await rm(folder, { recursive: true, force: true });

  const schemaPath = fileURLToPath(import.meta.resolve('@sododeck/schema/v1.json'));
  const schemaText = await readFile(schemaPath, 'utf8');
  const stamp = versionStamp(schemaText);
  const values = placeholders(stamp);

  for (const source of await listFiles(join(root, 'content'))) {
    const rel = relative(join(root, 'content'), source);
    await write(join(folder, rel), fill(await readFile(source, 'utf8'), values, rel));
  }
  await write(join(folder, 'VERSION.json'), `${JSON.stringify(stamp, null, 2)}\n`);
  await write(join(folder, 'schema', 'v1.json'), schemaText);
  for (const source of await listFiles(join(root, 'examples'))) {
    await write(
      join(folder, 'examples', relative(join(root, 'examples'), source)),
      await readFile(source),
    );
  }

  const result = await build({
    entryPoints: [join(root, 'src', 'cli', 'main.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    outfile: join(folder, 'scripts', 'sododeck.mjs'),
    define: { __SKILL_VERSION__: JSON.stringify(stamp.skill) },
    legalComments: 'none',
    minifySyntax: true,
    minifyWhitespace: true,
    metafile: true,
    logLevel: 'silent',
    banner: {
      js: `// Sododeck deck skill ${stamp.skill}. Generated; do not edit.\n${QUIET_LOCAL_STORAGE}`,
    },
  });
  const imported = Object.values(result.metafile.inputs).flatMap((input) =>
    input.imports.map((i) => i.path),
  );
  const network = imported.filter((path) => NETWORK_MODULES.includes(path.replace(/^node:/, '')));
  if (network.length > 0)
    throw new Error(`The bundle imports network modules: ${network.join(', ')}`);

  for (const command of COMMANDS) {
    await write(
      join(folder, 'scripts', `${command}.mjs`),
      `#!/usr/bin/env node\n// ${command}: see references/scripts.md.\nimport { runCli } from './sododeck.mjs';\n\nrunCli('${command}');\n`,
    );
  }

  const files = await listFiles(folder);
  const archive = join(outRoot, `${SKILL}.zip`);
  const entries = await Promise.all(
    files.map(async (path) => ({
      path: `${SKILL}/${relative(folder, path).split('\\').join('/')}`,
      data: await readFile(path),
    })),
  );
  await write(archive, zip(entries));
  return { folder, archive };
}

// The main module re-exports `runCli` for the entry files; esbuild keeps exports of the entry.
const outArg = process.argv.indexOf('--out');
if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  const out = outArg >= 0 ? (process.argv[outArg + 1] ?? join(root, 'dist')) : join(root, 'dist');
  const { folder, archive } = await buildSkill(out);
  process.stdout.write(
    `Built ${relative(process.cwd(), folder)} and ${relative(process.cwd(), archive)}\n`,
  );
}

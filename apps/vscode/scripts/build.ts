/**
 * Builds the extension (R12): bundles `src/extension.ts` into `dist/extension.cjs`, copies the
 * app's embed build into `media/embed/` and the webview shim next to it, then runs the bundle
 * guard. Needs `apps/app` built first (Turborepo orders that through the dev dependency).
 */
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

import { checkBundle, readPackageFiles } from './check-bundle';

const root = fileURLToPath(new URL('..', import.meta.url));
const embedSource = join(root, '../app/dist-embed');

async function exists(path: string): Promise<boolean> {
  try {
    await readdir(path);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(embedSource))) {
  console.error(
    `The editor build is missing (${embedSource}). Run "pnpm --filter @sododeck/app build" first.`,
  );
  process.exit(1);
}

await rm(join(root, 'media'), { recursive: true, force: true });
await mkdir(join(root, 'media'), { recursive: true });
await cp(embedSource, join(root, 'media/embed'), { recursive: true });
await cp(join(root, 'src/webview-shim.js'), join(root, 'media/webview-shim.js'));

// A webview can neither start a worker from a file nor read the file at run time, so every worker
// script goes into one classic script, by file name; the shim starts workers from it (R5, G2).
const assets = join(root, 'media/embed/assets');
const sources: Record<string, string> = {};
for (const name of await readdir(assets)) {
  if (/worker/i.test(name) && name.endsWith('.js')) {
    sources[name] = await readFile(join(assets, name), 'utf8');
  }
}
await writeFile(
  join(root, 'media/workers.js'),
  `window.__sododeckWorkers = ${JSON.stringify(sources)};\n`,
);

await build({
  entryPoints: [join(root, 'src/extension.ts')],
  outfile: join(root, 'dist/extension.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'es2022',
  external: ['vscode'],
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'warning',
});

const problems = checkBundle(await readPackageFiles(root));
if (problems.length > 0) {
  console.error(`Bundle check failed:\n${problems.map((p) => `- ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('Extension built. Bundle check passed.');

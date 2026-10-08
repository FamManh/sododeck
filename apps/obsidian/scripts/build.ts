/**
 * Builds the plugin (070 R3, R13): inlines the editor's embed build into one HTML string, bundles
 * `src/main.ts` into `main.js` (the page is a string inside it), fills `release/` with exactly the
 * three release assets and runs the bundle guard. Needs `apps/app` built first (Turborepo orders
 * that through the dev dependency). Never publishes.
 */
import { copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build, type Plugin } from 'esbuild';

import { checkBundle, readInput } from './check-bundle';
import { inlineEmbed, InlineEmbedError } from './inline-embed';

const root = fileURLToPath(new URL('..', import.meta.url));
const embedDir = join(root, '../app/dist-embed');

let html: string;
try {
  html = await inlineEmbed(embedDir);
} catch (error) {
  if (error instanceof InlineEmbedError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
await writeFile(join(root, 'embed.single.html'), html);

/** `import page from 'embed:single'` is the page: a string, never fetched at run time. */
function embedPlugin(page: string): Plugin {
  return {
    name: 'sododeck-embed',
    setup(b) {
      b.onResolve({ filter: /^embed:single$/ }, () => ({
        path: 'embed:single',
        namespace: 'embed',
      }));
      b.onLoad({ filter: /.*/, namespace: 'embed' }, () => ({
        contents: `export default ${JSON.stringify(page)};`,
        loader: 'js',
      }));
    },
  };
}

async function bundle(page: string, minify: boolean): Promise<string> {
  const result = await build({
    entryPoints: [join(root, 'src/main.ts')],
    outfile: join(root, 'main.js'),
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'cjs',
    target: 'es2022',
    external: ['obsidian', 'electron', '@codemirror/state', '@codemirror/view', '@lezer/common'],
    minify,
    sourcemap: false,
    legalComments: 'none',
    logLevel: 'warning',
    plugins: [embedPlugin(page)],
  });
  const out = result.outputFiles[0];
  if (out === undefined) throw new Error('esbuild produced nothing');
  return out.text;
}

await writeFile(join(root, 'main.js'), await bundle(html, true));
// The release folder holds exactly what a community plugin release carries (R13).
await rm(join(root, 'release'), { recursive: true, force: true });
await mkdir(join(root, 'release'));
for (const name of ['main.js', 'manifest.json', 'styles.css']) {
  await copyFile(join(root, name), join(root, 'release', name));
}

// The plugin's own code is checked without the page: the page has its own checks.
const problems = checkBundle(await readInput(root, await bundle('', false), html));
if (problems.length > 0) {
  console.error(`Bundle check failed:\n${problems.map((p) => `- ${p}`).join('\n')}`);
  process.exit(1);
}
const size = (await stat(join(root, 'release/main.js'))).size;
console.log(
  `Plugin built: release/main.js ${(size / 1024 / 1024).toFixed(2)} MiB. Bundle check passed.`,
);

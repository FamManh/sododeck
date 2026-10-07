/**
 * Turns the editor's embed build (`apps/app/dist-embed/`, 067) into ONE self-contained HTML string
 * for the Obsidian plugin (070 R3, T005): a community release is only `main.js`, `manifest.json`
 * and `styles.css`, so the embed travels inside `main.js` and is shown through `iframe srcdoc`.
 *
 * - every script chunk is re-bundled by esbuild into one classic script (dynamic imports included);
 * - every worker file becomes a source string started from a blob (`worker-loader.ts`);
 * - every stylesheet is inlined and fonts / images become data URLs;
 * - the page carries a Content-Security-Policy that allows no network of any kind.
 *
 * Fails with a plain message when the build output is not what this script understands, instead of
 * shipping a half-inlined page.
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build, type Plugin } from 'esbuild';

import { FAKE_BASE, WORKER_LOADER_SOURCE } from './worker-loader';

export const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' blob:",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'font-src data:',
  'worker-src blob:',
  'connect-src blob: data:',
].join('; ');

const MIME: Record<string, string> = {
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
};

export class InlineEmbedError extends Error {}

/** `__vite__mapDeps` lists the chunk and stylesheet files a dynamic import preloads. */
const MAP_DEPS =
  /__vite__mapDeps=\(i,m=__vite__mapDeps,d=\(m\.f\|\|\(m\.f=\[[^\]]*\]\)\)\)=>i\.map\(i=>d\[i\]\)/g;
const MAP_DEPS_USED = /m\.f\|\|\(m\.f=\[/;

/** Everything is already in the bundle, so preloading has nothing to fetch (and must not try). */
export function patchPreload(source: string): string {
  const patched = source.replace(MAP_DEPS, '__vite__mapDeps=(i)=>[]');
  if (MAP_DEPS_USED.test(patched)) {
    throw new InlineEmbedError(
      'The embed build has a preload list this script does not understand (inline-embed.ts patchPreload).',
    );
  }
  return patched;
}

function preloadPlugin(): Plugin {
  return {
    name: 'sododeck-preload',
    setup(b) {
      b.onLoad({ filter: /\.js$/ }, async (args) => ({
        contents: patchPreload(await readFile(args.path, 'utf8')),
        loader: 'js',
      }));
    },
  };
}

async function bundle(entry: string): Promise<string> {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2022',
    platform: 'browser',
    splitting: false,
    minify: true,
    legalComments: 'none',
    logLevel: 'silent',
    define: { 'import.meta.url': JSON.stringify(`${FAKE_BASE}index.js`) },
    plugins: [preloadPlugin()],
  });
  const out = result.outputFiles[0];
  if (out === undefined) throw new InlineEmbedError(`Nothing was built from ${entry}.`);
  return out.text;
}

async function dataUrl(path: string): Promise<string> {
  const mime = MIME[extname(path).toLowerCase()];
  if (mime === undefined) {
    throw new InlineEmbedError(`Cannot inline "${path}": unknown file type.`);
  }
  return `data:${mime};base64,${(await readFile(path)).toString('base64')}`;
}

/** Stylesheet text with every relative `url(...)` turned into a data URL. */
async function inlineCss(path: string): Promise<string> {
  let css = await readFile(path, 'utf8');
  const urls = new Set<string>();
  for (const m of css.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g)) {
    const url = m[2] ?? '';
    if (!url.startsWith('data:')) urls.add(url);
  }
  for (const url of urls) {
    if (/^[a-z]+:|^\/\//i.test(url) || url.startsWith('/')) {
      throw new InlineEmbedError(`"${path}" loads "${url}" from outside the embed.`);
    }
    const file = join(dirname(path), url);
    let data: string;
    try {
      data = await dataUrl(file);
    } catch (error) {
      if (error instanceof InlineEmbedError) throw error;
      throw new InlineEmbedError(`"${path}" refers to "${url}", which is missing.`);
    }
    css = css.split(`url(${url})`).join(`url(${data})`);
    css = css.split(`url("${url}")`).join(`url(${data})`);
    css = css.split(`url('${url}')`).join(`url(${data})`);
  }
  if (/url\(\s*(?!['"]?data:)/.test(css)) {
    throw new InlineEmbedError(`"${path}" still has a url() that was not inlined.`);
  }
  return css;
}

/** Text safe to put inside a `<script>` or `<style>` element. */
const forScript = (text: string): string => text.replace(/<\/(script|style)/gi, '<\\/$1');

export async function inlineEmbed(embedDir: string): Promise<string> {
  let html: string;
  try {
    html = await readFile(join(embedDir, 'embed.html'), 'utf8');
  } catch {
    throw new InlineEmbedError(
      `The editor build is missing (${embedDir}/embed.html). Run "pnpm --filter @sododeck/app build" first.`,
    );
  }
  const entryMatch = /<script[^>]*\ssrc="([^"]+)"/.exec(html);
  if (entryMatch === null) throw new InlineEmbedError('embed.html has no script to inline.');
  const entry = join(embedDir, entryMatch[1] ?? '');

  const assets = join(embedDir, 'assets');
  const names = await readdir(assets);
  const linked = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) =>
    join(embedDir, m[1] ?? ''),
  );
  const cssFiles = [
    ...linked,
    ...names
      .filter((n) => n.endsWith('.css'))
      .map((n) => join(assets, n))
      .filter((p) => !linked.includes(p)),
  ];
  const css = (await Promise.all(cssFiles.map(inlineCss))).join('\n');

  const workers: Record<string, string> = {};
  for (const name of names.filter((n) => /worker/i.test(n) && n.endsWith('.js'))) {
    workers[name] = await bundle(join(assets, name));
  }
  const main = await bundle(entry);

  const workerMap = forScript(JSON.stringify(workers));
  const page = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    '<title>Sododeck</title>',
    `<style>${forScript(css)}</style>`,
    '</head>',
    '<body>',
    '<div id="root"></div>',
    `<script>window.__sododeckWorkers=${workerMap};(${WORKER_LOADER_SOURCE})(window);</script>`,
    `<script>${forScript(main)}</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');

  if (/\s(?:src|href)\s*=\s*["'](?!#)/i.test(page.replace(/<script>[\s\S]*?<\/script>/g, ''))) {
    throw new InlineEmbedError('The inlined page still has a src or href attribute.');
  }
  return page;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = fileURLToPath(new URL('../../app/dist-embed', import.meta.url));
  const html = await inlineEmbed(dir);
  const { writeFile } = await import('node:fs/promises');
  await writeFile(fileURLToPath(new URL('../embed.single.html', import.meta.url)), html);
  console.log(`embed.single.html: ${(html.length / 1024 / 1024).toFixed(2)} MiB`);
}

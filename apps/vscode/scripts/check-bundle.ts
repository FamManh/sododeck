/**
 * Guard for the extension package (069 FR-024, SC-006): the bundle must not be able to reach the
 * network, and the embedded editor and the webview page must load nothing from a remote origin.
 * `checkBundle` is pure over `{ path: text }` so it is testable; run as a script after `build`.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const NETWORK_MODULES = ['http', 'https', 'net', 'tls', 'dgram', 'dns'];
const NETWORK_MARKERS = ['fetch(', 'XMLHttpRequest', 'WebSocket', 'createTelemetryLogger'];

const REMOTE = String.raw`https?:\/\/`;
const HTML_REMOTE = new RegExp(String.raw`\b(?:src|href)\s*=\s*["']?\s*${REMOTE}`, 'i');
const CSS_REMOTE = new RegExp(String.raw`url\(\s*["']?\s*${REMOTE}`, 'i');
const IMPORT_REMOTE = new RegExp(
  String.raw`(?:\bimport\s*\(\s*|\bfrom\s*|\bimport\s*)["']${REMOTE}`,
  'i',
);

/** Returns one line per problem; empty when the package is clean. */
export function checkBundle(files: Record<string, string>): string[] {
  const problems: string[] = [];
  for (const [path, text] of Object.entries(files)) {
    if (path === 'dist/extension.cjs') {
      for (const name of NETWORK_MODULES) {
        const pattern = new RegExp(
          String.raw`(?:require\(\s*|from\s*|import\s*\(?\s*)["'](?:node:)?${name}(?:\/[^"']*)?["']`,
        );
        const hit = pattern.exec(text);
        if (hit !== null)
          problems.push(`${path} imports "${hit[0].match(/["']([^"']+)["']/)?.[1] ?? name}"`);
      }
      for (const marker of NETWORK_MARKERS) {
        if (text.includes(marker)) problems.push(`${path} contains "${marker}"`);
      }
      continue;
    }
    if (/\.html?$/.test(path) && HTML_REMOTE.test(text)) {
      problems.push(`${path} loads a remote URL in src or href`);
    }
    if (/\.css$/.test(path) && CSS_REMOTE.test(text)) {
      problems.push(`${path} loads a remote URL in url()`);
    }
    if (/\.m?js$/.test(path) && IMPORT_REMOTE.test(text)) {
      problems.push(`${path} imports a remote URL`);
    }
  }
  return problems;
}

async function collect(root: string, dir: string, into: Record<string, string>): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await collect(root, path, into);
    else if (/\.(?:m?js|css|html?)$/.test(entry.name)) {
      into[relative(root, path).split('\\').join('/')] = await readFile(path, 'utf8');
    }
  }
}

/** Reads `dist/extension.cjs` and everything under `media/` of this package. */
export async function readPackageFiles(root: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  files['dist/extension.cjs'] = await readFile(join(root, 'dist/extension.cjs'), 'utf8');
  await collect(root, join(root, 'media'), files);
  return files;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const problems = checkBundle(await readPackageFiles(root));
  if (problems.length > 0) {
    console.error(`Bundle check failed:\n${problems.map((p) => `- ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log('Bundle check passed.');
}

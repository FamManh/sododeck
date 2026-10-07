// Guards the embeddable editor build (067 R2, SC-006): the files in dist-embed/ must carry no
// library database, offline cache, telemetry or browser-stored theme code, must load from relative
// URLs, and the dev-only host page must not reach the web build. Run after both builds.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const embed = join(root, 'dist-embed');
const web = join(root, 'dist');

const MARKERS = [
  'Dexie',
  'workbox',
  'serviceWorker.register',
  'posthog',
  '@sentry',
  'sododeck:theme',
  'indexedDB.open',
];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

const problems = [];

let entry;
try {
  entry = readFileSync(join(embed, 'embed.html'), 'utf8');
} catch {
  problems.push('dist-embed/embed.html is missing');
}
if (entry !== undefined && /(?:src|href)="\/(?!\/)/.test(entry)) {
  problems.push('dist-embed/embed.html references an absolute URL (hosts need relative ones)');
}

try {
  for (const path of files(embed)) {
    if (!/\.(?:js|mjs|css|html|json|webmanifest)$/.test(path)) continue;
    const text = readFileSync(path, 'utf8');
    for (const marker of MARKERS) {
      if (text.includes(marker)) problems.push(`${path.slice(root.length)} contains "${marker}"`);
    }
  }
} catch {
  problems.push('dist-embed/ is missing');
}

try {
  for (const path of files(web)) {
    if (!/\.(?:js|mjs|html)$/.test(path)) continue;
    if (readFileSync(path, 'utf8').includes('embed-host-page')) {
      problems.push(`${path.slice(root.length)} contains the dev-only embed host page`);
    }
  }
} catch {
  // No web build next to the embed build: nothing to compare.
}

if (problems.length > 0) {
  console.error(`Embed bundle check failed:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('Embed bundle check passed.');

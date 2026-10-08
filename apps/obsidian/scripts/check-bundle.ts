/**
 * Guard for the plugin release (070 FR-033, FR-034, SC-008): the plugin's own code must not be able
 * to reach the network, the inlined editor page must load nothing and carry a policy that allows no
 * network, and the release folder must hold exactly the three files a community plugin ships.
 * `checkBundle` is pure so it is testable; `build.ts` runs it after bundling.
 *
 * What is checked where: the plugin's own code is checked for network APIs and remote URLs. The
 * editor page also contains third-party libraries (a code editor, a layout engine) whose source
 * mentions `fetch(` or `WebSocket` in code paths this page never runs; there the guard checks what
 * can actually load something (any `src`/`href`, any `url()`), the forbidden markers of the embed
 * build, and that the page's Content-Security-Policy (`connect-src blob: data:`) forbids the network.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** `main.js` budget. First measurement (2026-10-07): the inlined editor is about 12.6 MiB. */
export const SIZE_BUDGET_BYTES = 16 * 1024 * 1024;

export const RELEASE_FILES = ['main.js', 'manifest.json', 'styles.css'] as const;

const NETWORK_MARKERS = [
  'fetch(',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'sendBeacon',
  'requestUrl(',
  'requestUrl:',
];
const ANALYTICS_MARKERS = ['posthog', 'sentry', 'plausible', 'gtag(', 'mixpanel', 'segment.io'];
/** The embed build's own forbidden markers (`apps/app/scripts/check-embed-bundle.mjs`). */
const EMBED_MARKERS = [
  'Dexie',
  'workbox',
  'serviceWorker.register',
  'posthog',
  '@sentry',
  'sododeck:theme',
  'indexedDB.open',
];
/**
 * URLs that are identifiers, not requests: the schema's own id, the JSON Schema dialect ids the
 * validation library names, XML namespaces, and the issue link inside the Yjs "imported twice"
 * message (the copy command validates a deck with the model, which brings Yjs into the plugin code;
 * the link is text in a console message, never requested).
 */
const ALLOWED_URLS = [
  'https://sododeck.com',
  'https://json-schema.org',
  'http://json-schema.org',
  'http://www.w3.org',
  'https://github.com/yjs/yjs/issues/',
];

export interface BundleInput {
  /** `main.js` with the editor page left out (the plugin's own code). */
  pluginJs: string;
  /** The inlined editor page. */
  embedHtml: string;
  /** Names of the files in the release folder. */
  releaseFiles: readonly string[];
  /** Size of the real `main.js`. */
  mainBytes: number;
}

function stripComments(js: string): string {
  return js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1');
}

/** Returns one line per problem; empty when the release is clean. */
export function checkBundle(input: BundleInput): string[] {
  const problems: string[] = [];
  const code = stripComments(input.pluginJs);

  // API names are matched as written: the schema's `websocket` protocol value is data, not a call.
  for (const marker of NETWORK_MARKERS) {
    if (code.includes(marker)) problems.push(`the plugin code contains "${marker}"`);
  }
  for (const marker of ANALYTICS_MARKERS) {
    if (code.toLowerCase().includes(marker)) problems.push(`the plugin code contains "${marker}"`);
  }
  if (/importScripts\s*\(\s*["'`]\s*(?:https?:)?\/\//.test(code)) {
    problems.push('the plugin code calls importScripts with a URL');
  }
  for (const m of code.matchAll(/https?:\/\/[^\s"'`)<>]+/g)) {
    const url = m[0];
    // A template such as `http://[${value}]` is a pattern, not an address.
    if (/[[\]$]/.test(url)) continue;
    if (!ALLOWED_URLS.some((allowed) => url.startsWith(allowed))) {
      problems.push(`the plugin code contains the remote URL ${url}`);
    }
  }

  const page = input.embedHtml;
  for (const marker of EMBED_MARKERS) {
    if (page.includes(marker)) problems.push(`the editor page contains "${marker}"`);
  }
  // Attributes that could load something. Scripts' own text is not scanned for attributes.
  const markup = page
    .replace(/<script>[\s\S]*?<\/script>/g, '')
    .replace(/<style>[\s\S]*?<\/style>/g, '');
  if (/\s(?:src|href|srcset|poster|data)\s*=\s*["']?(?!#)/i.test(markup)) {
    problems.push('the editor page has a src or href attribute (it must load nothing)');
  }
  const style = [...page.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1] ?? '').join('\n');
  if (/url\(\s*(?!["']?data:)/i.test(style)) {
    problems.push('the editor page has a stylesheet url() that is not a data URL');
  }
  if (/@import/i.test(style)) problems.push('the editor page has a stylesheet @import');

  const csp = /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i.exec(page)?.[1];
  if (csp === undefined) {
    problems.push('the editor page has no Content-Security-Policy');
  } else {
    if (!csp.includes("default-src 'none'"))
      problems.push("the policy must start from default-src 'none'");
    const connect = /connect-src([^;]*)/.exec(csp)?.[1] ?? '';
    if (connect.trim() === '' || /https?:|\*|wss?:/.test(connect)) {
      problems.push(`the policy's connect-src allows the network (${connect.trim() || 'missing'})`);
    }
    if (/(?:script|style|img|font|worker|frame)-src[^;]*(?:https?:|\*)/.test(csp)) {
      problems.push('the policy allows a remote source');
    }
  }

  for (const name of RELEASE_FILES) {
    if (!input.releaseFiles.includes(name)) problems.push(`the release folder has no ${name}`);
  }
  for (const name of input.releaseFiles) {
    if (!(RELEASE_FILES as readonly string[]).includes(name)) {
      problems.push(`the release folder has an extra file: ${name}`);
    }
  }
  if (input.mainBytes > SIZE_BUDGET_BYTES) {
    problems.push(
      `main.js is ${(input.mainBytes / 1024 / 1024).toFixed(1)} MiB, over the ${(SIZE_BUDGET_BYTES / 1024 / 1024).toFixed(0)} MiB budget`,
    );
  }
  return problems;
}

/** The release folder is `release/`: `build` fills it with exactly the three assets to upload. */
export async function readInput(
  root: string,
  pluginJs: string,
  embedHtml: string,
): Promise<BundleInput> {
  const release = join(root, 'release');
  return {
    pluginJs,
    embedHtml,
    releaseFiles: await readdir(release),
    mainBytes: (await stat(join(release, 'main.js'))).size,
  };
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const html = await readFile(join(root, 'embed.single.html'), 'utf8');
  const main = await readFile(join(root, 'release/main.js'), 'utf8');
  // The guard on its own cannot tell the page from the plugin in `main.js`; `build.ts` does.
  const problems = checkBundle(
    await readInput(root, main.split(JSON.stringify(html)).join('""'), html),
  );
  if (problems.length > 0) {
    console.error(`Bundle check failed:\n${problems.map((p) => `- ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log('Bundle check passed.');
}

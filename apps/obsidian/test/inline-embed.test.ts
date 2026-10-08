import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { runInNewContext } from 'node:vm';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { checkBundle } from '../scripts/check-bundle';
import { CSP, inlineEmbed, InlineEmbedError, patchPreload } from '../scripts/inline-embed';
import { WORKER_LOADER_SOURCE } from '../scripts/worker-loader';

let dir: string;

const MAP_DEPS =
  'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./lazy-1.js","./lazy-1.css"])))=>i.map(i=>d[i]);';

async function fixture(overrides: Record<string, string> = {}): Promise<void> {
  await mkdir(join(dir, 'assets'), { recursive: true });
  const files: Record<string, string> = {
    'embed.html': `<!doctype html><html><head>
<script type="module" crossorigin src="./assets/embed-1.js"></script>
<link rel="modulepreload" crossorigin href="./assets/shared-1.js">
<link rel="stylesheet" crossorigin href="./assets/embed-1.css">
</head><body><div id="root"></div></body></html>`,
    'assets/embed-1.js': `import { shared } from './shared-1.js';
${MAP_DEPS}
globalThis.result = { shared, worker: new URL('./layout.worker-1.js', import.meta.url).href };
globalThis.later = () => import('./lazy-1.js');
globalThis.mapDeps = __vite__mapDeps([0, 1]);`,
    'assets/shared-1.js': 'export const shared = "</script>shared";',
    'assets/lazy-1.js': 'globalThis.lazyValue = 42;',
    'assets/layout.worker-1.js': `import { helper } from './helper-1.js';\nself.onmessage = () => self.postMessage(helper);`,
    'assets/helper-1.js': 'export const helper = "helped";',
    'assets/embed-1.css':
      '@font-face{font-family:G;src:url(./font-1.woff2) format("woff2")}\nbody{color:red}',
    'assets/lazy-1.css': '.lazy{background:url("data:image/png;base64,AAAA")}',
    'assets/font-1.woff2': 'FONTBYTES',
    ...overrides,
  };
  for (const [name, text] of Object.entries(files)) await writeFile(join(dir, name), text);
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'sododeck-embed-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('inlineEmbed', () => {
  it('produces one self-contained page that passes the bundle guard', async () => {
    await fixture();
    const html = await inlineEmbed(dir);
    expect(html).toContain(CSP);
    expect(html).not.toMatch(/\s(?:src|href)=/);
    expect(html).not.toContain('./assets/');
    expect(
      checkBundle({
        pluginJs: '',
        embedHtml: html,
        releaseFiles: ['main.js', 'manifest.json', 'styles.css'],
        mainBytes: 1,
      }),
    ).toEqual([]);
  });

  it('inlines fonts as data URLs and keeps every stylesheet', async () => {
    await fixture();
    const html = await inlineEmbed(dir);
    expect(html).toContain(
      `url(data:font/woff2;base64,${Buffer.from('FONTBYTES').toString('base64')})`,
    );
    expect(html).toContain('body{color:red}');
    expect(html).toContain('.lazy{background:url("data:image/png;base64,AAAA")}');
  });

  it('bundles chunks and dynamic imports into the one script, escaping script ends', async () => {
    await fixture();
    const html = await inlineEmbed(dir);
    expect(html).toContain('lazyValue=42');
    expect(html).not.toMatch(/<\/script>shared/);
    expect(html.match(/<script>/g)).toHaveLength(2);
  });

  it('turns every worker into a source string by file name and fakes the base URL', async () => {
    await fixture();
    const html = await inlineEmbed(dir);
    expect(html).toContain('window.__sododeckWorkers={"layout.worker-1.js":');
    expect(html).toContain('helped');
    expect(html).toContain('https://sododeck.invalid/assets/');
    expect(html).not.toContain('import.meta');
  });

  it('removes the preload list: nothing is left to fetch', async () => {
    await fixture();
    const html = await inlineEmbed(dir);
    expect(html).not.toContain('lazy-1.css"');
    expect(html).not.toContain('m.f=');
  });

  it('says what is missing', async () => {
    await expect(inlineEmbed(join(dir, 'nope'))).rejects.toThrow(
      /pnpm --filter @sododeck\/app build/,
    );
    await fixture({ 'assets/embed-1.css': 'a{background:url(./gone.png)}' });
    await expect(inlineEmbed(dir)).rejects.toBeInstanceOf(InlineEmbedError);
    await fixture({ 'assets/embed-1.css': 'a{background:url(https://x.test/a.png)}' });
    await expect(inlineEmbed(dir)).rejects.toThrow(/outside the embed/);
  });

  it('refuses a preload list it does not understand', () => {
    expect(() => patchPreload('const d=(m.f||(m.f=["./a.js"]));')).toThrow(InlineEmbedError);
    expect(patchPreload('const x = 1;')).toBe('const x = 1;');
  });
});

describe('worker loader', () => {
  it('starts a worker from a blob made of the named source, with nested sources along', () => {
    const made: { source: string }[] = [];
    class FakeBlob {
      constructor(readonly parts: string[]) {
        made.push({ source: parts.join('') });
      }
    }
    const started: { url: string; options: unknown }[] = [];
    function Native(this: unknown, url: string, options: unknown): void {
      started.push({ url, options });
    }
    const scope = {
      Worker: Native,
      Blob: FakeBlob,
      URL: Object.assign(URL, { createObjectURL: () => 'blob:x' }),
      location: { href: 'about:srcdoc' },
      __sododeckWorkers: {
        'a.js': 'new Worker("b.js"); /* a */',
        'b.js': '/* b */',
        'c.js': '/* c */',
      },
    };
    runInNewContext(`(${WORKER_LOADER_SOURCE})(scope)`, { scope });
    const Wrapped = scope.Worker as unknown as new (url: string, options: unknown) => unknown;
    new Wrapped('https://sododeck.invalid/assets/a.js', { type: 'module', name: 'n' });
    expect(started).toEqual([{ url: 'blob:x', options: { name: 'n' } }]);
    const source = made[0]?.source ?? '';
    expect(source).toContain('/* a */');
    expect(source).toContain('"b.js":"/* b */"');
    expect(source).not.toContain('/* c */');
    expect(() => new Wrapped('https://sododeck.invalid/assets/missing.js', {})).toThrow(
      /missing\.js/,
    );
  });
});

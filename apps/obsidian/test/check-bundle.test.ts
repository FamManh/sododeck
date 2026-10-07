import { describe, expect, it } from 'vitest';

import { checkBundle, SIZE_BUDGET_BYTES, type BundleInput } from '../scripts/check-bundle';

const CSP =
  "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; worker-src blob:; connect-src blob: data:\">";

function clean(): BundleInput {
  return {
    pluginJs: 'const a = 1; /* see https://sododeck.com for details */\nexports.x = a;',
    embedHtml: `<!doctype html><html><head>${CSP}</head><body><script>var x = "http://www.w3.org/2000/svg";</script></body></html>`,
    releaseFiles: ['main.js', 'manifest.json', 'styles.css'],
    mainBytes: 1000,
  };
}

describe('checkBundle', () => {
  it('passes on a clean fixture', () => {
    expect(checkBundle(clean())).toEqual([]);
  });

  for (const marker of [
    'fetch(',
    'XMLHttpRequest',
    'WebSocket',
    'EventSource',
    'sendBeacon',
    'requestUrl(',
    'posthog',
    'sentry',
  ]) {
    it(`fails when the plugin code contains ${marker}`, () => {
      const input = { ...clean(), pluginJs: `function f(){ ${marker}x }` };
      expect(checkBundle(input).join('\n')).toContain(marker);
    });
  }

  it('fails on importScripts with a URL, not on importScripts alone', () => {
    const bad = { ...clean(), pluginJs: 'importScripts("https://example.com/x.js")' };
    expect(checkBundle(bad)).not.toEqual([]);
    const fine = { ...clean(), pluginJs: 'const importScriptsName = 1;' };
    expect(checkBundle(fine)).toEqual([]);
  });

  it('fails on a remote URL in the plugin code outside comments', () => {
    const bad = { ...clean(), pluginJs: 'const u = "https://tracker.example/collect";' };
    expect(checkBundle(bad).join('\n')).toContain('https://tracker.example/collect');
  });

  it('allows documentation URLs in comments and the schema id', () => {
    const ok = {
      ...clean(),
      pluginJs:
        '// docs: https://sododeck.com/docs\nconst s = "https://sododeck.com/schema/v1.json";',
    };
    expect(checkBundle(ok)).toEqual([]);
  });

  it('allows schema data that merely names a protocol, and URL identifiers', () => {
    const ok = {
      ...clean(),
      pluginJs:
        'const e = ["http", "websocket"]; const d = "http://json-schema.org/draft-07/schema#"; const t = `http://[${v}]`;',
    };
    expect(checkBundle(ok)).toEqual([]);
  });

  it("fails on the embed's forbidden markers", () => {
    for (const marker of ['Dexie', 'workbox', 'serviceWorker.register', 'indexedDB.open']) {
      const bad = { ...clean(), embedHtml: `${clean().embedHtml}<script>${marker}</script>` };
      expect(checkBundle(bad).join('\n')).toContain(marker);
    }
  });

  it('fails when the inlined page loads anything by src or href', () => {
    const html = clean().embedHtml;
    expect(
      checkBundle({ ...clean(), embedHtml: `${html}<script src="https://x.test/a.js"></script>` }),
    ).not.toEqual([]);
    expect(checkBundle({ ...clean(), embedHtml: `${html}<link href="./a.css">` })).not.toEqual([]);
    expect(checkBundle({ ...clean(), embedHtml: `${html}<img src="x.png">` })).not.toEqual([]);
  });

  it('fails when the page has no policy or one that allows the network', () => {
    const noCsp = { ...clean(), embedHtml: '<html><head></head><body></body></html>' };
    expect(checkBundle(noCsp).join('\n')).toContain('Content-Security-Policy');
    const open = {
      ...clean(),
      embedHtml: clean().embedHtml.replace('connect-src blob: data:', 'connect-src https:'),
    };
    expect(checkBundle(open).join('\n')).toContain('connect-src');
  });

  it('fails over budget and on unexpected release files', () => {
    expect(checkBundle({ ...clean(), mainBytes: SIZE_BUDGET_BYTES + 1 }).join('\n')).toContain(
      'budget',
    );
    expect(
      checkBundle({
        ...clean(),
        releaseFiles: ['main.js', 'manifest.json', 'styles.css', 'embed.html'],
      }).join('\n'),
    ).toContain('embed.html');
    expect(
      checkBundle({ ...clean(), releaseFiles: ['main.js', 'manifest.json'] }).join('\n'),
    ).toContain('styles.css');
  });
});

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { checkBundle } from '../scripts/check-bundle';
import {
  buildWebviewPage,
  contentSecurityPolicy,
  makeNonce,
  messagePage,
} from '../src/webview-html';

const EMBED = `<!doctype html><html><head><meta charset="UTF-8" />
<script type="module" crossorigin src="./assets/embed.js"></script>
<link rel="modulepreload" crossorigin href="./assets/a.js">
<link rel="stylesheet" crossorigin href="./assets/embed.css">
<link rel="icon" href="favicon.svg"></head><body><div id="root"></div></body></html>`;

const page = (nonce = 'n0nce') =>
  buildWebviewPage({
    embedHtml: EMBED,
    toWebviewUri: (r) => `https://file%2B.vscode-resource.vscode-cdn.net/ext/media/embed/${r}`,
    shimUri: 'https://file%2B.vscode-resource.vscode-cdn.net/ext/media/webview-shim.js',
    cspSource: 'https://*.vscode-cdn.net',
    nonce,
  });

describe('buildWebviewPage', () => {
  it('has exactly the policy of R5, with no remote source and blob workers', () => {
    const csp = contentSecurityPolicy('SRC', 'N');
    expect(csp).toBe(
      "default-src 'none'; script-src 'nonce-N' SRC; style-src SRC 'unsafe-inline'; img-src SRC data: blob:; font-src SRC; connect-src SRC blob: data:; worker-src blob:",
    );
    expect(page()).toContain(
      `content="${contentSecurityPolicy('https://*.vscode-cdn.net', 'n0nce')}"`,
    );
    expect(csp).not.toMatch(/https?:/);
  });

  it('puts the nonce on every script and loads the shim first', () => {
    const html = page();
    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    expect(scripts).toHaveLength(2);
    for (const tag of scripts) expect(tag).toContain('nonce="n0nce"');
    expect(scripts[0]).toContain('webview-shim.js');
    expect(html.indexOf('webview-shim.js')).toBeLessThan(html.indexOf('assets/embed.js'));
  });

  it('rewrites every relative src and href through the mapper', () => {
    const html = page();
    expect(html).toContain('/media/embed/assets/embed.js"');
    expect(html).toContain('/media/embed/assets/a.js"');
    expect(html).toContain('/media/embed/assets/embed.css"');
    expect(html).toContain('/media/embed/favicon.svg"');
    expect(html).not.toMatch(/(?:src|href)="\.\//);
  });

  it('contains no remote URL outside the webview resource origin', () => {
    const html = page().replaceAll('https://file%2B.vscode-resource.vscode-cdn.net', 'LOCAL');
    expect(checkBundle({ 'media/embed/generated.html': html })).toEqual([]);
    expect(html).not.toMatch(/https?:\/\/(?!\*\.vscode-cdn)/);
  });

  it('makes a different nonce each time', () => {
    expect(makeNonce()).toMatch(/^[0-9a-f]{32}$/);
    expect(makeNonce()).not.toBe(makeNonce());
  });
});

describe('messagePage', () => {
  it('shows an escaped message with no script', () => {
    const html = messagePage('Already <open>', 'SRC');
    expect(html).toContain('Already &#60;open&#62;');
    expect(html).not.toContain('<script');
  });
});

describe('webview-shim.js', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../src/webview-shim.js', import.meta.url)),
    'utf8',
  );

  function run() {
    const posted: unknown[] = [];
    const handlers: ((e: unknown) => void)[] = [];
    const dispatched: { data: unknown; source: unknown }[] = [];
    const win: Record<string, unknown> = {
      addEventListener: (_t: string, h: (e: unknown) => void) => handlers.push(h),
      dispatchEvent: (e: { data: unknown; source: unknown }) => {
        dispatched.push(e);
        for (const h of handlers) h(e);
      },
    };
    class FakeMessageEvent {
      data: unknown;
      origin: unknown;
      source: unknown;
      constructor(_t: string, init: { data: unknown; origin: unknown; source?: unknown }) {
        // Like the real constructor: a plain object as `source` is refused.
        if (init.source !== undefined) throw new TypeError('source is not a MessageEventSource');
        Object.assign(this, init);
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- runs the shim source against a fake window
    new Function('window', 'acquireVsCodeApi', 'MessageEvent', source)(
      win,
      () => ({ postMessage: (m: unknown) => posted.push(m) }),
      FakeMessageEvent,
    );
    return { win, posted, handlers, dispatched };
  }

  it('makes window.parent post through the webview API', () => {
    const { win, posted } = run();
    (win.parent as { postMessage(m: unknown): void }).postMessage({ type: 'ready' });
    expect(posted).toEqual([{ type: 'ready' }]);
  });

  it('re-dispatches extension messages with the fake parent as source, once', () => {
    const { win, dispatched } = run();
    let stopped = false;
    const incoming = {
      data: { type: 'theme' },
      origin: 'vscode-webview://x',
      source: 'frame',
      stopImmediatePropagation: () => {
        stopped = true;
      },
    };
    (win.dispatchEvent as (e: unknown) => void)(incoming);
    expect(stopped).toBe(true);
    expect(dispatched).toHaveLength(2);
    expect(dispatched[1]?.data).toEqual({ type: 'theme' });
    expect(dispatched[1]?.source).toBe(win.parent);
  });
});

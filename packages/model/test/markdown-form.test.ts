import { readdirSync, readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { inspectDeckText } from '../src/import-check';
import {
  fromMarkdown,
  isDeckMarkdown,
  MARKER_KEY,
  MARKER_VALUE,
  toMarkdown,
} from '../src/markdown-form';
import { emptyText, richDeck, textOf } from './markdown-helpers';

const samplesDir = fileURLToPath(new URL('../../../apps/app/src/samples/', import.meta.url));
const samples = readdirSync(samplesDir)
  .filter((n) => n.endsWith('.sododeck.json'))
  .map((n) => ({ name: n, text: textOf(JSON.parse(readFileSync(samplesDir + n, 'utf8'))) }));

const marked = (body: string) => `---\n${MARKER_KEY}: ${MARKER_VALUE}\n---\n${body}`;

describe('isDeckMarkdown', () => {
  it('needs the marker in the front matter', () => {
    expect(isDeckMarkdown(marked(''))).toBe(true);
    expect(isDeckMarkdown(`---\ntags: a\n---\n${MARKER_KEY}: ${MARKER_VALUE}\n`)).toBe(false);
    expect(isDeckMarkdown('# A note\n')).toBe(false);
    expect(isDeckMarkdown(`---\n${MARKER_KEY}: other\n---\n`)).toBe(false);
  });
  it('tolerates CRLF and a BOM', () => {
    expect(isDeckMarkdown(`\uFEFF---\r\n${MARKER_KEY}: ${MARKER_VALUE}\r\n---\r\nx`)).toBe(true);
  });
});

describe('wrapper', () => {
  it('round-trips every sample deck and the edge decks', () => {
    const corpus = [
      ...samples,
      { name: 'empty', text: emptyText() },
      { name: 'rich', text: textOf(richDeck()) },
      {
        name: 'special',
        text: textOf({
          ...richDeck(),
          name: 'A %% title ``` with `ticks` and ```` fences',
          description: 'line %%\n```json\n{"a":1}\n```\n%% sododeck:end %%\n# not a heading',
        }),
      },
    ];
    for (const { name, text } of corpus) {
      const md = toMarkdown(text);
      expect(isDeckMarkdown(md), name).toBe(true);
      const back = fromMarkdown(md);
      expect(back, name).toEqual({ ok: true, deckText: text, edited: false });
    }
  });

  it('keeps the deck block valid JSON when text holds %% and long backtick runs', () => {
    const text = textOf({ ...richDeck(), description: '%%%% ````` %%' });
    const md = toMarkdown(text);
    expect(md).not.toMatch(/%%%%/);
    const back = fromMarkdown(md);
    expect(back.ok && back.deckText).toBe(text);
  });

  it('keeps text before and after the region and other front matter keys byte for byte', () => {
    const text = textOf(richDeck());
    const previous = `---\ntags: [a, b]\n${MARKER_KEY}: ${MARKER_VALUE}\naliases: x\n---\nMy intro\n\n${toMarkdown(text).replace(/^---\n[\s\S]*?---\n/, '')}\nMy outro\n  indented\n`;
    const next = toMarkdown(textOf({ ...richDeck(), name: 'Renamed' }), previous);
    expect(
      next.startsWith(
        `---\ntags: [a, b]\n${MARKER_KEY}: ${MARKER_VALUE}\naliases: x\n---\nMy intro\n\n`,
      ),
    ).toBe(true);
    expect(next.endsWith('\nMy outro\n  indented\n')).toBe(true);
  });

  it('adds the marker when previous front matter lacks it', () => {
    const next = toMarkdown(emptyText(), '---\ntags: [a]\n---\nhello\n');
    expect(next.startsWith(`---\n${MARKER_KEY}: ${MARKER_VALUE}\ntags: [a]\n---\nhello\n`)).toBe(
      true,
    );
  });

  it('is idempotent with previous', () => {
    for (const { text } of [...samples, { text: textOf(richDeck()) }]) {
      const once = toMarkdown(text);
      expect(toMarkdown(text, once)).toBe(once);
    }
  });

  it('reads a marker-only note as the empty deck', () => {
    expect(fromMarkdown(marked(''))).toEqual({ ok: true, deckText: emptyText(), edited: false });
  });

  it('refuses with plain entries', () => {
    const code = (md: string) => {
      const r = fromMarkdown(md);
      return r.ok ? 'ok' : r.entries[0]?.code;
    };
    expect(code('# no front matter\n')).toBe('md-no-marker');
    expect(code(marked('%% sododeck:begin %%\n# x %%deck%%\n%% sododeck:end %%\n'))).toBe(
      'md-no-deck-block',
    );
    expect(
      code(
        marked(
          '%% sododeck:begin %%\n%% sododeck:data\n```json\n{oops\n```\n%%\n%% sododeck:end %%\n',
        ),
      ),
    ).toBe('md-deck-block-not-json');
    const one = toMarkdown(emptyText());
    const block = /%% sododeck:data[\s\S]*?\n%%\n/.exec(one)?.[0] ?? '';
    expect(code(one.replace('%% sododeck:end %%', `${block}%% sododeck:end %%`))).toBe(
      'md-two-deck-blocks',
    );
    const r = fromMarkdown('# x');
    expect(!r.ok && r.entries[0]?.message).toMatch(/not a deck/);
  });

  it('returns a block that parses but is not a valid deck', () => {
    const md = marked(
      '%% sododeck:begin %%\n%% sododeck:data\n```json\n{"version": 1}\n```\n%%\n%% sododeck:end %%\n',
    );
    const r = fromMarkdown(md);
    expect(r.ok).toBe(true);
    if (r.ok) expect(inspectDeckText(r.deckText).ok).toBe(false);
  });

  it('converts the 500-node deck in 50 ms each way', () => {
    const nodes = Array.from({ length: 500 }, (_, i) => ({
      id: `n${String(i)}`,
      type: 'service',
      title: `Service ${String(i)}`,
      description: `Does thing ${String(i)}`,
      position: { x: i, y: i },
    }));
    const edges = Array.from({ length: 1000 }, (_, i) => ({
      id: `e${String(i)}`,
      from: `n${String(i % 500)}`,
      to: `n${String((i + 1) % 500)}`,
      label: `l${String(i)}`,
    }));
    const text = textOf({
      ...richDeck(),
      nodes,
      edges,
      groups: [],
      flows: [],
      features: [],
      stickies: [],
      views: [],
      rules: {},
    });
    // The best of five runs: the budget is about the code, not about a busy machine.
    const best = (run: () => void): number => {
      let min = Infinity;
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        run();
        min = Math.min(min, performance.now() - t0);
      }
      return min;
    };
    const md = toMarkdown(text);
    expect(best(() => toMarkdown(text))).toBeLessThan(50);
    expect(best(() => fromMarkdown(md))).toBeLessThan(50);
  });
});

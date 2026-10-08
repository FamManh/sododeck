import { describe, expect, it } from 'vitest';

import { fromMarkdown, toMarkdown } from '../src/markdown-form';
import { richDeck, textOf } from './markdown-helpers';

const base = textOf(richDeck());

function cycle(previous: string, mutate: (md: string) => string, deckText = base): string {
  const edited = mutate(previous);
  const read = fromMarkdown(edited);
  if (!read.ok) throw new Error('unreadable');
  return toMarkdown(read.deckText.length > 0 ? deckText : deckText, edited);
}

describe('user text survives write/read cycles', () => {
  it('keeps text before and after, extra keys and foreign blocks over 10 cycles with edits', () => {
    let md = toMarkdown(base);
    md = md.replace('sododeck-plugin: parsed\n', 'sododeck-plugin: parsed\nowner: me\n');
    md = `${md.replace('%% sododeck:begin', 'My intro\n\n%% sododeck:begin')}\nMy outro\n`;
    md = md.replace(
      '%%web:description%%\nStorefront\n',
      '%%web:description%%\nStorefront\n\n#### My own heading\n\nMy own paragraph about the web app.\n',
    );
    md = md.replace('## Groups', '### Top-level foreign %%nope%%\n\n## Groups');
    let current = md;
    for (let i = 0; i < 10; i++) {
      const read = fromMarkdown(current);
      if (!read.ok) throw new Error('unreadable');
      const deck = JSON.parse(read.deckText) as { name: string };
      deck.name = `Shop ${String(i)}`;
      current = toMarkdown(textOf(deck), current);
    }
    expect(current).toContain('owner: me');
    expect(current.startsWith('---\nowner: me\n') || current.includes('\nowner: me\n')).toBe(true);
    expect(current).toContain('My intro\n\n%% sododeck:begin');
    expect(current.endsWith('\nMy outro\n')).toBe(true);
    expect(current).toContain('#### My own heading\n\nMy own paragraph about the web app.');
    expect(current.indexOf('#### My own heading')).toBeGreaterThan(
      current.indexOf('### Web %%web%%'),
    );
    expect(current.indexOf('#### My own heading')).toBeLessThan(current.indexOf('### API %%api%%'));
    expect(current).toContain('# Shop 9 %%deck%%');
  });

  it('a foreign block before any marked item stays at the top of the region', () => {
    const md = toMarkdown(base).replace(/^(%% sododeck:begin.*\n)/m, '$1Welcome, reader.\n\n');
    const next = toMarkdown(base, md);
    expect(next.indexOf('Welcome, reader.')).toBeGreaterThan(next.indexOf('%% sododeck:begin'));
    expect(next.indexOf('Welcome, reader.')).toBeLessThan(next.indexOf('# Shop %%deck%%'));
    expect(toMarkdown(base, next)).toBe(next);
  });

  it("reads the user's own paragraph inside a body into that field and writes it back", () => {
    const md = toMarkdown(base).replace('Storefront\n', 'Storefront\n\nMy extra paragraph.\n');
    const read = fromMarkdown(md);
    if (!read.ok) throw new Error('unreadable');
    const deck = JSON.parse(read.deckText) as { nodes: { description: string }[] };
    expect(deck.nodes[0]?.description).toBe('Storefront\n\nMy extra paragraph.');
    expect(toMarkdown(read.deckText, md)).toContain('Storefront\n\nMy extra paragraph.\n');
  });

  it('writes empty outside text without previous', () => {
    const md = toMarkdown(base);
    expect(md.startsWith('---\nsododeck-plugin: parsed\n---\n%% sododeck:begin')).toBe(true);
    expect(md.endsWith('%% sododeck:end %%\n')).toBe(true);
  });

  it('a text-only change outside the region leaves the deck text equal', () => {
    const md = toMarkdown(base);
    const changed = `${md}\nlater note\n`;
    const a = fromMarkdown(md);
    const b = fromMarkdown(changed);
    expect(a.ok && b.ok && a.deckText === b.deckText).toBe(true);
    expect(cycle(changed, (x) => x)).toBe(changed);
  });
});

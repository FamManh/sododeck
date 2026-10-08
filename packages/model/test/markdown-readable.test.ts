import { describe, expect, it } from 'vitest';

import { inspectDeckText } from '../src/import-check';
import { fromMarkdown, READABLE_FIELDS, toMarkdown } from '../src/markdown-form';
import { richDeck, textOf } from './markdown-helpers';

const text = textOf(richDeck());
const md = toMarkdown(text);

function read(markdown: string) {
  const r = fromMarkdown(markdown);
  if (!r.ok) throw new Error('unreadable');
  return { deck: JSON.parse(r.deckText) as Record<string, unknown>, edited: r.edited };
}

type Path = (string | number)[];

/** Sets (or, with `undefined`, removes) the value at `path` in parsed deck JSON. */
function put(deck: unknown, path: Path, value: unknown): void {
  let node = deck as Record<string | number, unknown>;
  for (const key of path.slice(0, -1)) node = node[key] as Record<string | number, unknown>;
  const last = path[path.length - 1] as string | number;
  if (value === undefined) Reflect.deleteProperty(node, last);
  else node[last] = value;
}

function replaceOnce(source: string, from: string, to: string): string {
  expect(source).toContain(from);
  return source.replace(from, to);
}

describe('rich deck is a valid deck (fixture check)', () => {
  it('passes the loader', () => {
    expect(inspectDeckText(text).ok).toBe(true);
  });
});

describe('writing the readable part', () => {
  it('writes headings, id markers and bodies in the deck order', () => {
    expect(md).toContain('# Shop %%deck%%');
    expect(md).toContain('%%deck:description%%\nThe shop.\n\nSecond paragraph.');
    expect(md).toContain('## Components\n\n### Web %%web%%\n\n%%web:description%%\nStorefront');
    expect(md.indexOf('### Web %%web%%')).toBeLessThan(md.indexOf('### API %%api%%'));
    expect(md).toContain('### calls %%e1%%');
    expect(md).toContain('### (unnamed) %%e2%%');
    expect(md).toContain('#### Send %%flow.a.s1%%');
    expect(md).toContain('%%flow.a.s1:notes%%\nn1');
    expect(md).toContain('### Discount %%r1%%');
    expect(md).toContain('### Note %%s1%%\n\n%%s1:text%%\nRemember');
    expect(md).toContain('### Overview %%v1%%');
  });
  it('writes no marker line for an absent optional field and an empty body for ""', () => {
    expect(md).not.toContain('%%api:description%%');
    const withEmpty = toMarkdown(textOf({ ...richDeck(), description: '' }));
    expect(withEmpty).toContain('%%deck:description%%\n\n');
  });
  it('lists pictures as links or plain names', () => {
    const id = 'a'.repeat(64);
    const withPictures = toMarkdown(
      textOf({
        ...richDeck(),
        assets: {
          [id]: {
            type: 'image/png',
            bytes: 1,
            width: 40,
            height: 40,
            name: 'a.png',
            path: 'img/a b.png',
          },
          ['b'.repeat(64)]: {
            type: 'image/png',
            bytes: 1,
            width: 40,
            height: 40,
            name: 'embedded.png',
            data: 'AA==',
          },
        },
      }),
    );
    expect(withPictures).toContain(`- [[img/a b.png]] %%${id}%%`);
    expect(withPictures).toContain(`- embedded.png %%${'b'.repeat(64)}%%`);
  });
});

describe('reading edits by id', () => {
  it('changes exactly the edited title and nothing else', () => {
    const edited = replaceOnce(md, '### Web %%web%%', '### Web shop %%web%%');
    const { deck, edited: flag } = read(edited);
    const expected: unknown = JSON.parse(text);
    put(expected, ['nodes', 0, 'title'], 'Web shop');
    expect(deck).toEqual(expected);
    expect(flag).toBe(true);
  });

  const cases: { name: string; from: string; to: string; path: Path; value: unknown }[] = [
    {
      name: 'deck name',
      from: '# Shop %%deck%%',
      to: '# New shop %%deck%%',
      path: ['name'],
      value: 'New shop',
    },
    {
      name: 'deck description',
      from: 'The shop.',
      to: 'Changed.',
      path: ['description'],
      value: 'Changed.\n\nSecond paragraph.',
    },
    {
      name: 'node description',
      from: 'Storefront',
      to: 'Front',
      path: ['nodes', 0, 'description'],
      value: 'Front',
    },
    {
      name: 'group title',
      from: '### Backend %%g1%%',
      to: '### Back %%g1%%',
      path: ['groups', 0, 'title'],
      value: 'Back',
    },
    {
      name: 'group description',
      from: 'Servers',
      to: 'Machines',
      path: ['groups', 0, 'description'],
      value: 'Machines',
    },
    {
      name: 'edge label',
      from: '### calls %%e1%%',
      to: '### asks %%e1%%',
      path: ['edges', 0, 'label'],
      value: 'asks',
    },
    {
      name: 'unnamed edge gets a label',
      from: '### (unnamed) %%e2%%',
      to: '### back %%e2%%',
      path: ['edges', 1, 'label'],
      value: 'back',
    },
    {
      name: 'edge description',
      from: 'HTTP',
      to: 'gRPC',
      path: ['edges', 0, 'description'],
      value: 'gRPC',
    },
    {
      name: 'feature title',
      from: '### Checkout %%f1%%',
      to: '### Pay %%f1%%',
      path: ['features', 0, 'title'],
      value: 'Pay',
    },
    {
      name: 'feature description',
      from: '%%f1:description%%\nPay',
      to: '%%f1:description%%\nPay now',
      path: ['features', 0, 'description'],
      value: 'Pay now',
    },
    {
      name: 'flow title',
      from: '### Order %%flow.a%%',
      to: '### Buy %%flow.a%%',
      path: ['flows', 0, 'title'],
      value: 'Buy',
    },
    {
      name: 'flow description',
      from: 'Place an order',
      to: 'Buy things',
      path: ['flows', 0, 'description'],
      value: 'Buy things',
    },
    {
      name: 'step title',
      from: '#### Send %%flow.a.s1%%',
      to: '#### Post %%flow.a.s1%%',
      path: ['flows', 0, 'steps', 0, 'title'],
      value: 'Post',
    },
    {
      name: 'step description',
      from: '%%flow.a.s1:description%%\ngo',
      to: '%%flow.a.s1:description%%\nrun',
      path: ['flows', 0, 'steps', 0, 'description'],
      value: 'run',
    },
    {
      name: 'step notes',
      from: '%%flow.a.s1:notes%%\nn1',
      to: '%%flow.a.s1:notes%%\nn2',
      path: ['flows', 0, 'steps', 0, 'notes'],
      value: 'n2',
    },
    {
      name: 'rule title',
      from: '### Discount %%r1%%',
      to: '### Offers %%r1%%',
      path: ['rules', 'r1', 'title'],
      value: 'Offers',
    },
    {
      name: 'rule description',
      from: '%%r1:description%%\nRules',
      to: '%%r1:description%%\nTable',
      path: ['rules', 'r1', 'description'],
      value: 'Table',
    },
    {
      name: 'sticky text',
      from: '%%s1:text%%\nRemember',
      to: '%%s1:text%%\nForget',
      path: ['stickies', 0, 'text'],
      value: 'Forget',
    },
    {
      name: 'view title',
      from: '### Overview %%v1%%',
      to: '### Map %%v1%%',
      path: ['views', 0, 'title'],
      value: 'Map',
    },
  ];
  for (const c of cases) {
    it(`reads ${c.name}`, () => {
      const { deck, edited } = read(replaceOnce(md, c.from, c.to));
      const expected: unknown = JSON.parse(text);
      put(expected, c.path, c.value);
      expect(deck).toEqual(expected);
      expect(edited).toBe(true);
    });
  }

  it('lets the readable part win over the block', () => {
    const edited = replaceOnce(md, '"title": "API"', '"title": "Stale"');
    expect(read(edited).deck).toEqual(JSON.parse(text));
  });

  it('ignores an empty required title and an empty sticky text', () => {
    const noTitle = replaceOnce(md, '### Web %%web%%', '###  %%web%%');
    expect(read(noTitle)).toEqual({ deck: JSON.parse(text) as unknown, edited: false });
    const noText = replaceOnce(md, '%%s1:text%%\nRemember', '%%s1:text%%\n');
    expect(read(noText).deck).toEqual(JSON.parse(text));
  });

  it('ignores deleted headings and marker lines', () => {
    const noHeading = replaceOnce(md, '### Web %%web%%\n', '');
    expect(read(noHeading).deck).toEqual(JSON.parse(text));
    const noMarker = replaceOnce(md, '%%web:description%%\n', '');
    expect(read(noMarker).deck).toEqual(JSON.parse(text));
  });

  it('clears an optional field emptied on purpose', () => {
    const cleared = replaceOnce(md, '%%web:description%%\nStorefront', '%%web:description%%\n');
    const expected: unknown = JSON.parse(text);
    put(expected, ['nodes', 0, 'description'], undefined);
    expect(read(cleared).deck).toEqual(expected);
  });

  it('adds a body when someone types a marker line for an absent field', () => {
    const typed = replaceOnce(
      md,
      '### API %%api%%\n',
      '### API %%api%%\n\n%%api:description%%\nHello\n',
    );
    const expected: unknown = JSON.parse(text);
    put(expected, ['nodes', 1, 'description'], 'Hello');
    expect(read(typed).deck).toEqual(expected);
  });

  it('ignores unknown ids, unknown fields and unmarked headings', () => {
    const noise = md.replace(
      '## Groups',
      '### Ghost %%nope%%\n\n%%nope:description%%\nx\n\n%%web:colour%%\nred\n\n### Plain heading\n\n## Groups',
    );
    expect(read(noise).deck).toEqual(JSON.parse(text));
  });

  it('reads picture list links by asset id, only when the link is allowed', () => {
    const id = 'c'.repeat(64);
    const deck = textOf({
      ...richDeck(),
      assets: {
        [id]: {
          type: 'image/png',
          bytes: 1,
          width: 40,
          height: 40,
          name: 'a.png',
          path: 'img/a.png',
        },
      },
    });
    const note = toMarkdown(deck);
    const moved = replaceOnce(note, '[[img/a.png]]', '[[pics/a.png|alias#sub]]');
    const got = read(moved).deck as { assets: Record<string, { path: string }> };
    expect(got.assets[id]?.path).toBe('pics/a.png');
    const outside = replaceOnce(note, '[[img/a.png]]', '[[/abs/x.png]]');
    expect(
      (read(outside).deck as { assets: Record<string, { path: string }> }).assets[id]?.path,
    ).toBe('img/a.png');
    const unknown = replaceOnce(note, `%%${id}%%`, `%%${'d'.repeat(64)}%%`);
    expect(read(unknown).edited).toBe(false);
  });

  it('reports edited only for real differences', () => {
    expect(read(md).edited).toBe(false);
    expect(read(md.replace(/\n/g, '\r\n')).edited).toBe(false);
  });

  it('covers every row of the table', () => {
    const kinds = new Set(READABLE_FIELDS.map((k) => k.collection));
    for (const c of [
      'deck',
      'nodes',
      'groups',
      'edges',
      'features',
      'flows',
      'steps',
      'rules',
      'stickies',
      'views',
    ]) {
      expect(kinds.has(c as never)).toBe(true);
    }
  });
});

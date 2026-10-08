import { fromMarkdown, toMarkdown } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { PictureHost } from '../src/picture-host';
import { deckWithPathPicture, emptyDeckText, PNG, PNG_ID } from './deck-fixtures';
import { makeFakes } from './fakes';

const NOTE = 'file:///ws/docs/arch.sododeck.md';
const stored = `arch.assets/${PNG_ID.slice(0, 16)}.png`;
const put = {
  type: 'picture-put' as const,
  id: PNG_ID,
  mime: 'image/png',
  name: 'pic.png',
  bytes: PNG,
};

function setup(path: string, over: Parameters<typeof makeFakes>[0] = {}) {
  const fakes = makeFakes(over);
  const deckText = deckWithPathPicture(PNG_ID, path);
  fakes.files.set(NOTE, toMarkdown(deckText));
  const host = new PictureHost(NOTE, () => deckText, fakes);
  return { fakes, host, deckText };
}

describe('pictures in a note: put', () => {
  it('with storage file, a trusted note gets <name>.assets/<file>', async () => {
    const fakes = makeFakes({ storage: 'file' });
    const host = new PictureHost(NOTE, () => emptyDeckText(), fakes);
    expect(await host.put(put)).toEqual({ type: 'picture-stored', id: PNG_ID, path: stored });
    expect(fakes.files.data.has(`file:///ws/docs/${stored}`)).toBe(true);
  });

  it('after the canvas links it, saving writes the link line', () => {
    const note = toMarkdown(deckWithPathPicture(PNG_ID, stored));
    expect(note).toContain(`- [[${stored}]] %%${PNG_ID}%%`);
    expect(fromMarkdown(note)).toMatchObject({ ok: true });
  });

  it('an untrusted workspace stores nothing', async () => {
    const fakes = makeFakes({ storage: 'file', trusted: false });
    const host = new PictureHost(NOTE, () => emptyDeckText(), fakes);
    expect(await host.put(put)).toMatchObject({ type: 'picture-store-failed' });
    expect(fakes.files.writes).toEqual([]);
  });

  it('a path with [, | or # gets no link line', () => {
    for (const path of ['a[1].assets/p.png', 'a|b.assets/p.png', 'a#b.assets/p.png']) {
      expect(toMarkdown(deckWithPathPicture(PNG_ID, path))).not.toContain(`[[${path}]]`);
    }
  });
});

describe('pictures in a note: get', () => {
  const get = { type: 'picture-get' as const, id: PNG_ID };

  it('serves the path relative to the note', async () => {
    const { fakes, host } = setup('arch.assets/a.png');
    fakes.files.set('file:///ws/docs/arch.assets/a.png', PNG);
    expect(await host.get(get)).toMatchObject({ type: 'picture', id: PNG_ID });
  });

  it('finds a short name by a unique path ending', async () => {
    const { fakes, host } = setup('a.png');
    fakes.files.set('file:///ws/attachments/a.png', PNG);
    expect(await host.get(get)).toMatchObject({ type: 'picture', id: PNG_ID });
  });

  it('finds a path ending with folders', async () => {
    const { fakes, host } = setup('pics/a.png');
    fakes.files.set('file:///ws/other/pics/a.png', PNG);
    expect(await host.get(get)).toMatchObject({ type: 'picture' });
  });

  it('refuses two matches and names the ambiguity', async () => {
    const { fakes, host } = setup('a.png');
    fakes.files.set('file:///ws/one/a.png', PNG);
    fakes.files.set('file:///ws/two/a.png', PNG);
    const answer = await host.get(get);
    expect(answer).toMatchObject({ type: 'picture-missing' });
    expect(JSON.stringify(answer)).toContain('several');
  });

  it('reports missing when nothing matches', async () => {
    const { host } = setup('a.png');
    expect(await host.get(get)).toMatchObject({ type: 'picture-missing', reason: 'not found' });
  });

  it('refuses a match outside the workspace', async () => {
    const { fakes, host } = setup('a.png');
    fakes.files.set('file:///elsewhere/a.png', PNG);
    expect(await host.get(get)).toMatchObject({
      type: 'picture-missing',
      reason: 'outside the workspace',
    });
  });

  it('refuses a match whose bytes do not hash to the id', async () => {
    const { fakes, host } = setup('a.png');
    fakes.files.set('file:///ws/attachments/a.png', new Uint8Array([1, 2, 3]));
    expect(await host.get(get)).toMatchObject({
      type: 'picture-missing',
      reason: 'the file changed',
    });
  });

  it('a plain .sododeck keeps the relative-only behavior', async () => {
    const fakes = makeFakes();
    const deck = 'file:///ws/docs/arch.sododeck';
    const text = deckWithPathPicture(PNG_ID, 'a.png');
    fakes.files.set('file:///ws/attachments/a.png', PNG);
    const host = new PictureHost(deck, () => text, fakes);
    expect(await host.get(get)).toMatchObject({ type: 'picture-missing', reason: 'not found' });
  });

  it('an untrusted workspace serves nothing', async () => {
    const { fakes, host } = setup('arch.assets/a.png', { trusted: false });
    fakes.files.set('file:///ws/docs/arch.assets/a.png', PNG);
    expect(await host.get(get)).toMatchObject({ type: 'picture-missing' });
  });
});

import { inspectDeckText } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { PictureHost } from '../src/picture-host';
import { deckWithPathPicture, emptyDeckText, PNG, PNG_ID } from './deck-fixtures';
import { makeFakes } from './fakes';

const DECK = 'file:///ws/docs/arch.sododeck';

function setup(deckText = emptyDeckText(), deck = DECK) {
  const fakes = makeFakes();
  fakes.files.set(deck, deckText);
  const host = new PictureHost(deck, () => deckText, fakes);
  return { fakes, host };
}

describe('fixtures', () => {
  it('make a deck the model opens with one file picture', () => {
    const result = inspectDeckText(deckWithPathPicture(PNG_ID, 'arch.assets/a.png'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.loaded.fileRefs.map((r) => r.path)).toEqual(['arch.assets/a.png']);
  });
});

describe('picture-put', () => {
  const put = {
    type: 'picture-put' as const,
    id: PNG_ID,
    mime: 'image/png',
    name: 'pic.png',
    bytes: PNG,
  };
  const stored = `arch.assets/${PNG_ID.slice(0, 16)}.png`;

  it('writes <deck>.assets/<16 hex>.<ext> and answers with the relative path', async () => {
    const { fakes, host } = setup();
    expect(await host.put(put)).toEqual({ type: 'picture-stored', id: PNG_ID, path: stored });
    expect([...(fakes.files.data.get(`file:///ws/docs/${stored}`) ?? [])]).toEqual([...PNG]);
  });

  it('uses the base name of x.sododeck.json', async () => {
    const { host } = setup(emptyDeckText(), 'file:///ws/docs/x.sododeck.json');
    expect(await host.put(put)).toMatchObject({ path: `x.assets/${PNG_ID.slice(0, 16)}.png` });
  });

  it('reuses an identical existing file and never overwrites a different one', async () => {
    const { fakes, host } = setup();
    fakes.files.set(`file:///ws/docs/${stored}`, PNG);
    expect(await host.put(put)).toMatchObject({ path: stored });
    expect(fakes.files.writes).toEqual([]);

    fakes.files.set(`file:///ws/docs/${stored}`, new Uint8Array([9, 9]));
    const answer = await host.put(put);
    expect(answer).toMatchObject({
      type: 'picture-stored',
      path: stored.replace('.png', '-2.png'),
    });
    expect([...(fakes.files.data.get(`file:///ws/docs/${stored}`) ?? [])]).toEqual([9, 9]);

    fakes.files.set(`file:///ws/docs/${stored.replace('.png', '-2.png')}`, new Uint8Array([8]));
    expect(await host.put(put)).toMatchObject({ path: stored.replace('.png', '-3.png') });
  });

  it('fails plainly when the deck name breaks the path rule (a colon)', async () => {
    const { host } = setup(emptyDeckText(), 'file:///ws/docs/a:b.sododeck');
    const answer = await host.put(put);
    expect(answer.type).toBe('picture-store-failed');
    expect(JSON.stringify(answer)).toContain(':');
  });

  it('fails when the bytes do not match the id, the type is unknown or the workspace is untrusted', async () => {
    const { fakes, host } = setup();
    expect((await host.put({ ...put, bytes: new Uint8Array([1]) })).type).toBe(
      'picture-store-failed',
    );
    expect((await host.put({ ...put, mime: 'application/pdf' })).type).toBe('picture-store-failed');
    fakes.control.trusted = false;
    expect(await host.put(put)).toMatchObject({
      type: 'picture-store-failed',
      reason: 'workspace not trusted',
    });
    expect(fakes.files.writes).toEqual([]);
  });

  it('answers with the reason when the write fails', async () => {
    const { fakes, host } = setup();
    fakes.files.failWrites.add(`file:///ws/docs/${stored}`);
    expect(await host.put(put)).toMatchObject({ type: 'picture-store-failed' });
  });

  it('refuses to write through a link that points out of the workspace', async () => {
    const { fakes, host } = setup();
    fakes.files.links.set('file:///ws/docs/arch.assets', 'file:///secret');
    fakes.files.folders.add('file:///secret');
    expect(await host.put(put)).toMatchObject({
      type: 'picture-store-failed',
      reason: 'outside the workspace',
    });
    expect(fakes.files.writes).toEqual([]);
  });
});

describe('picture-get', () => {
  const path = 'arch.assets/pic.png';

  it('answers with the bytes after the size and hash checks', async () => {
    const { fakes, host } = setup(deckWithPathPicture(PNG_ID, path));
    fakes.files.set(`file:///ws/docs/${path}`, PNG);
    const answer = await host.get({ type: 'picture-get', id: PNG_ID });
    expect(answer).toMatchObject({ type: 'picture', id: PNG_ID, mime: 'image/png' });
    expect(answer.type === 'picture' && [...answer.bytes]).toEqual([...PNG]);
  });

  it.each([
    ['not found', () => {}],
    [
      'the file changed',
      (f: ReturnType<typeof makeFakes>) => {
        f.files.set('file:///ws/docs/arch.assets/pic.png', new Uint8Array([1, 2]));
      },
    ],
  ])('answers missing: %s', async (reason, prepare) => {
    const { fakes, host } = setup(deckWithPathPicture(PNG_ID, path));
    prepare(fakes);
    expect(await host.get({ type: 'picture-get', id: PNG_ID })).toMatchObject({
      type: 'picture-missing',
      reason,
    });
  });

  it('answers missing for an unknown id, an untrusted workspace and a path that leaves the workspace', async () => {
    const { fakes, host } = setup(deckWithPathPicture(PNG_ID, path));
    expect(await host.get({ type: 'picture-get', id: 'b'.repeat(64) })).toMatchObject({
      reason: 'not found',
    });
    fakes.files.set(`file:///ws/docs/${path}`, PNG);
    fakes.control.trusted = false;
    expect(await host.get({ type: 'picture-get', id: PNG_ID })).toMatchObject({
      reason: 'workspace not trusted',
    });

    const outside = setup(deckWithPathPicture(PNG_ID, '../../../etc/pic.png'));
    outside.fakes.files.set('file:///etc/pic.png', PNG);
    expect(await outside.host.get({ type: 'picture-get', id: PNG_ID })).toMatchObject({
      reason: 'outside the workspace',
    });
  });

  it('refuses a link inside the workspace that points out', async () => {
    const { fakes, host } = setup(deckWithPathPicture(PNG_ID, path));
    fakes.files.links.set('file:///ws/docs/arch.assets', 'file:///secret');
    fakes.files.set('file:///secret/pic.png', PNG);
    expect(await host.get({ type: 'picture-get', id: PNG_ID })).toMatchObject({
      reason: 'outside the workspace',
    });
  });

  it('refuses a file over 5 MiB without reading it', async () => {
    const { fakes, host } = setup(deckWithPathPicture(PNG_ID, path));
    fakes.files.set(`file:///ws/docs/${path}`, new Uint8Array(5_242_881));
    expect(await host.get({ type: 'picture-get', id: PNG_ID })).toMatchObject({
      type: 'picture-missing',
    });
  });
});

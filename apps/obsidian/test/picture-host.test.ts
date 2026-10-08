import { describe, expect, it } from 'vitest';

import { openReady, noteOf, settle } from './harness';
import { deckWithPicture, OTHER, PIC, PIC_ID } from './pictures';

const NOTE = 'docs/Pics.sododeck.md';
const PLAIN = 'docs/Pics.sododeck';
const NAME = `${PIC_ID.slice(0, 16)}.png`;

describe('picture-put (US4)', () => {
  it('stores a new picture where the attachment settings say and answers with the link text', async () => {
    const h = await openReady(NOTE, noteOf(deckWithPicture('x.png')), (f) => {
      f.vault.attachments = { folder: 'attachments' };
    });
    h.editor.putPicture(PIC_ID, 'image/png', 'dot.png', PIC);
    await settle();
    expect(h.vault.paths()).toContain(`attachments/${NAME}`);
    expect(h.editor.of('picture-stored')).toEqual([
      { type: 'picture-stored', id: PIC_ID, path: NAME },
    ]);
  });

  it('reuses an identical existing file without writing', async () => {
    const h = await openReady(NOTE, noteOf(deckWithPicture('x.png')), (f) => {
      f.vault.attachments = { folder: 'attachments' };
      f.vault.seed(`attachments/${NAME}`, PIC);
    });
    h.editor.putPicture(PIC_ID, 'image/png', 'dot.png', PIC);
    await settle();
    expect(h.vault.calls.filter((c) => c.startsWith('createBinary'))).toEqual([]);
    expect(h.editor.of('picture-stored')[0]?.type).toBe('picture-stored');
  });

  it('never overwrites a different file with the same name: uses the deduplicated name', async () => {
    const h = await openReady(NOTE, noteOf(deckWithPicture('x.png')), (f) => {
      f.vault.attachments = { folder: 'attachments' };
      f.vault.seed(`attachments/${NAME}`, OTHER);
    });
    h.editor.putPicture(PIC_ID, 'image/png', 'dot.png', PIC);
    await settle();
    expect(h.vault.paths()).toContain(`attachments/${PIC_ID.slice(0, 16)} 1.png`);
    expect(await h.vault.readBinary(`attachments/${NAME}`)).toEqual(OTHER);
    expect(h.editor.of('picture-stored')[0]).toMatchObject({ type: 'picture-stored' });
  });

  it('keeps the picture embedded when the link text breaks the rule', async () => {
    const h = await openReady(NOTE, noteOf(deckWithPicture('x.png')));
    h.vault.linkTextFor = () => 'a:b/x.png';
    h.editor.putPicture(PIC_ID, 'image/png', 'dot.png', PIC);
    await settle();
    expect(h.editor.of('picture-store-failed')[0]?.reason).toMatch(/":"/);
    expect(h.editor.of('picture-stored')).toEqual([]);
  });

  it('keeps the picture embedded when the file cannot be written, or the bytes are wrong', async () => {
    const h = await openReady(NOTE, noteOf(deckWithPicture('x.png')));
    h.vault.createBinary = () => Promise.reject(new Error('read-only vault'));
    h.editor.putPicture(PIC_ID, 'image/png', 'dot.png', PIC);
    await settle();
    expect(h.editor.of('picture-store-failed')[0]?.reason).toMatch(/read-only vault/);
    h.editor.putPicture(PIC_ID, 'image/png', 'dot.png', new Uint8Array([1, 2, 3]));
    await settle();
    expect(h.editor.of('picture-store-failed')[1]?.reason).toMatch(/changed/);
    h.editor.putPicture(PIC_ID, 'application/pdf', 'x.pdf', PIC);
    await settle();
    expect(h.editor.of('picture-store-failed')[2]?.reason).toMatch(/not supported/);
  });

  it('declares pictures only for a note with the setting on attachments (FR-024)', async () => {
    const plain = await openReady(PLAIN, deckWithPicture('x.png'));
    expect(plain.editor.of('init')[0]?.capabilities.pictures).toBe(false);
    plain.editor.putPicture(PIC_ID, 'image/png', 'dot.png', PIC);
    await settle();
    expect(plain.editor.of('picture-store-failed')).toHaveLength(1);
    expect(plain.vault.paths()).toEqual([PLAIN]);
  });
});

describe('picture-get (US4)', () => {
  it('serves the picture from the note link, verified', async () => {
    const h = await openReady(NOTE, noteOf(deckWithPicture('dot.png')), (f) => {
      f.vault.seed('pics/dot.png', PIC);
    });
    h.editor.getPicture(PIC_ID);
    await settle();
    expect(h.editor.of('picture')).toEqual([
      { type: 'picture', id: PIC_ID, mime: 'image/png', bytes: PIC },
    ]);
  });

  it('says missing with the path for a link that resolves to nothing', async () => {
    const h = await openReady(NOTE, noteOf(deckWithPicture('gone.png')));
    h.editor.getPicture(PIC_ID);
    await settle();
    expect(h.editor.of('picture-missing')).toEqual([
      { type: 'picture-missing', id: PIC_ID, reason: 'not found: gone.png' },
    ]);
    h.editor.getPicture('f'.repeat(64));
    await settle();
    expect(h.editor.of('picture-missing')[1]?.reason).toBe('not found');
  });

  it('says the file changed when the bytes no longer match the id', async () => {
    const h = await openReady(NOTE, noteOf(deckWithPicture('dot.png')), (f) => {
      f.vault.seed('dot.png', OTHER);
    });
    h.editor.getPicture(PIC_ID);
    await settle();
    expect(h.editor.of('picture-missing')[0]?.reason).toBe('the file changed');
  });

  it('refuses a path that leaves the vault without reading anything (US4-7, SC-009)', async () => {
    for (const [path, text] of [
      ['../../../outside.png', 'outside the vault'],
      ['/etc/passwd', 'starts with'],
      ['C:/x.png', 'drive'],
    ] as const) {
      const h = await openReady(NOTE, noteOf(deckWithPicture(path)));
      const before = h.vault.calls.length;
      h.editor.getPicture(PIC_ID);
      await settle();
      expect(h.editor.of('picture-missing')[0]?.reason, path).toMatch(new RegExp(text));
      expect(h.vault.calls.slice(before), path).toEqual([]);
    }
  });

  it('serves a plain deck picture from the deck folder and reads nothing outside the vault', async () => {
    const h = await openReady(PLAIN, deckWithPicture('Pics.assets/dot.png'), (f) => {
      f.vault.seed('docs/Pics.assets/dot.png', PIC);
    });
    h.editor.getPicture(PIC_ID);
    await settle();
    expect(h.editor.of('picture')).toHaveLength(1);
    const out = await openReady(PLAIN, deckWithPicture('../../../x.png'));
    out.editor.getPicture(PIC_ID);
    await settle();
    expect(out.editor.of('picture-missing')[0]?.reason).toMatch(/outside the vault/);
    expect(out.vault.calls.filter((c) => c.startsWith('read'))).toEqual([]);
  });

  it('still serves a link that only resolves by file name after a move (US4-5)', async () => {
    const h = await openReady(NOTE, noteOf(deckWithPicture('dot.png')), (f) => {
      f.vault.updateLinksOnRename = false;
      f.vault.seed('somewhere/else/dot.png', PIC);
    });
    h.editor.getPicture(PIC_ID);
    await settle();
    expect(h.editor.of('picture')).toHaveLength(1);
  });
});

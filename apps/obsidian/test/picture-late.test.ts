import { describe, expect, it } from 'vitest';

import { noteOf, openReady, settle } from './harness';
import { deckWithPicture, PIC, PIC_ID } from './pictures';

const NOTE = 'docs/Pics.sododeck.md';

describe('late and moved pictures (US4-4, US4-6, SC-010)', () => {
  it('sends the picture when a missing file is created, without a reopen', async () => {
    const h = await openReady(NOTE, noteOf(deckWithPicture('dot.png')));
    h.editor.getPicture(PIC_ID);
    await settle();
    expect(h.editor.of('picture-missing')).toHaveLength(1);
    h.vault.externalCreate('attachments/dot.png', PIC);
    await settle();
    expect(h.editor.of('picture')).toEqual([
      { type: 'picture', id: PIC_ID, mime: 'image/png', bytes: PIC },
    ]);
    // Answered once: later events do not resend it.
    h.vault.externalCreate('other.txt', new Uint8Array([1]));
    await settle();
    expect(h.editor.of('picture')).toHaveLength(1);
  });

  it('does not read on events for unrelated paths', async () => {
    const h = await openReady(NOTE, noteOf(deckWithPicture('dot.png')));
    h.editor.getPicture(PIC_ID);
    await settle();
    const before = h.vault.calls.length;
    h.vault.externalCreate('notes/unrelated.png', new Uint8Array([1]));
    await settle();
    expect(
      h.vault.calls.slice(before).filter((c) => c.startsWith('read') || c.startsWith('resolve')),
    ).toEqual([]);
  });

  it('sends it when the file is moved into place', async () => {
    const h = await openReady(NOTE, noteOf(deckWithPicture('dot.png')), (f) => {
      f.vault.seed('tmp/old.png', PIC);
    });
    h.editor.getPicture(PIC_ID);
    await settle();
    h.vault.externalRename('tmp/old.png', 'moved/dot.png');
    await settle();
    expect(h.editor.of('picture')).toHaveLength(1);
  });

  it('after a move the app rewrites the link, and reading the note applies it (US4-3)', async () => {
    const pic = deckWithPicture('dot.png');
    const note = noteOf(pic);
    const h = await openReady(NOTE, note, (f) => {
      f.vault.updateLinksOnRename = false;
      f.vault.seed('dot.png', PIC);
    });
    // The user's own tools rewrote the link text after moving the file.
    h.vault.externalRename('dot.png', 'pics/dot.png');
    h.vault.externalWrite(NOTE, note.replace('[[dot.png]]', '[[pics/dot.png]]'));
    await settle();
    const change = h.editor.of('external-change').at(-1);
    expect(change?.text).toContain('"path": "pics/dot.png"');
    // And the picture is still served from the new link.
    h.editor.getPicture(PIC_ID);
    await settle();
    expect(h.editor.of('picture')).toHaveLength(1);
  });
});

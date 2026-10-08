import { describe, expect, it } from 'vitest';

import { deckText, noteOf, openReady, settle } from './harness';

const NOTE = 'docs/Shop.sododeck.md';

describe('text edits in the note reach the canvas (US2)', () => {
  it('a card title edited in the note arrives as an external change with only that change', async () => {
    const note = noteOf(deckText());
    const h = await openReady(NOTE, note);
    h.vault.externalWrite(NOTE, note.replace('### Orders %%a%%', '### Orders service %%a%%'));
    await settle();
    expect(h.editor.of('external-change')).toEqual([
      { type: 'external-change', text: deckText('Shop', 'Orders service') },
    ]);
  });

  it('a canvas edit writes the note and keeps the paragraph outside the region', async () => {
    const note = `intro\n\n${noteOf(deckText()).replace(/^---\n[\s\S]*?---\n/, (m) => m)}`;
    const withIntro = noteOf(deckText()).replace(
      '%% sododeck:begin',
      'My intro\n\n%% sododeck:begin',
    );
    const h = await openReady(NOTE, withIntro);
    h.editor.sendChange(deckText('Shop', 'From canvas'));
    await settle();
    expect(h.file()).toContain('My intro\n\n%% sododeck:begin');
    expect(h.file()).toContain('### From canvas %%a%%');
    expect(note.length).toBeGreaterThan(0);
  });
});

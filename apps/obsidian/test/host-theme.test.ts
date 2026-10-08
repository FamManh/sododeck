import { describe, expect, it } from 'vitest';

import { deckText, noteOf, openReady, settle } from './harness';
import { deckWithPicture } from './pictures';

describe('theme (US5)', () => {
  it('starts with the app scheme', async () => {
    const h = await openReady('a.sododeck', deckText(), (f) => {
      f.setScheme('dark');
    });
    expect(h.editor.of('init')[0]?.theme).toBe('dark');
  });

  it('sends one theme message per real change and nothing else', async () => {
    const h = await openReady('a.sododeck', deckText());
    h.editor.clear();
    h.setScheme('dark');
    h.setScheme('dark');
    await settle();
    expect(h.editor.recorded()).toEqual([{ type: 'theme', scheme: 'dark' }]);
    h.setScheme('light');
    await settle();
    expect(h.editor.recorded().at(-1)).toEqual({ type: 'theme', scheme: 'light' });
    expect(h.editor.of('init')).toEqual([]);
    expect(h.editor.of('external-change')).toEqual([]);
  });

  it('sends nothing before the canvas is ready or after close', async () => {
    const { open } = await import('./harness');
    const h = open('a.sododeck', deckText());
    h.setScheme('dark');
    await settle();
    expect(h.editor.recorded()).toEqual([]);
    await h.session.close();
    h.setScheme('light');
    await settle();
    expect(h.editor.recorded()).toEqual([]);
  });
});

describe('setting changes (US4-11)', () => {
  it('sends a second init with the same text only when the capabilities change', async () => {
    const note = noteOf(deckWithPicture('dot.png'));
    const h = await openReady('a.sododeck.md', note);
    const text = h.editor.of('init')[0]?.text;
    h.setPictureStorage('embedded');
    await settle();
    expect(h.editor.of('init')).toHaveLength(2);
    expect(h.editor.of('init')[1]).toMatchObject({ text, capabilities: { pictures: false } });
    h.setPictureStorage('embedded');
    await settle();
    expect(h.editor.of('init')).toHaveLength(2);
    h.setPictureStorage('attachments');
    await settle();
    expect(h.editor.of('init')[2]?.capabilities.pictures).toBe(true);
  });

  it('a plain deck never changes capabilities', async () => {
    const h = await openReady('a.sododeck', deckText());
    h.setPictureStorage('embedded');
    await settle();
    expect(h.editor.of('init')).toHaveLength(1);
  });
});

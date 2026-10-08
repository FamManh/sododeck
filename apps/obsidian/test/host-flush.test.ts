import { describe, expect, it } from 'vitest';

import { deckText, openReady, settle } from './harness';

const PLAIN = 'Shop.sododeck';

describe('flush on close, hide and quit (FR-008, SC-002)', () => {
  it('asks the canvas, writes what it sends last, then closes', async () => {
    const h = await openReady(PLAIN, deckText());
    h.editor.editWithoutSending(deckText('Shop', 'Last moment'));
    await h.session.close();
    expect(h.file()).toBe(deckText('Shop', 'Last moment'));
    expect(h.editor.of('flush')).toHaveLength(1);
  });

  it('sends and writes nothing after close', async () => {
    const h = await openReady(PLAIN, deckText());
    await h.session.close();
    h.editor.clear();
    h.editor.sendChange(deckText('Shop', 'Late'));
    h.vault.externalWrite(PLAIN, deckText('Shop', 'Outside'));
    h.setScheme('dark');
    await settle();
    expect(h.editor.recorded()).toEqual([]);
    expect(h.file()).toBe(deckText('Shop', 'Outside'));
  });

  it('after 1.5 s without an answer it writes the last known text and says so', async () => {
    const h = await openReady(PLAIN, deckText());
    h.editor.autoFlush = false;
    h.editor.sendChange(deckText('Shop', 'Known'));
    const done = h.session.flush();
    await settle();
    h.clock.advance(1499);
    await settle();
    expect(h.notices).toEqual([]);
    h.clock.advance(2);
    await done;
    expect(h.file()).toBe(deckText('Shop', 'Known'));
    expect(h.notices.join()).toMatch(/did not answer in time/);
  });

  it('a second flush while one waits does not write twice or ask twice', async () => {
    const h = await openReady(PLAIN, deckText());
    h.editor.autoFlush = false;
    h.editor.sendChange(deckText('Shop', 'Once'));
    const a = h.session.flush();
    const b = h.session.flush();
    await settle();
    h.editor.answerFlush();
    await Promise.all([a, b]);
    expect(h.editor.of('flush')).toHaveLength(1);
    expect(h.vault.calls.filter((c) => c.startsWith('writeText'))).toHaveLength(1);
  });

  it('a flush is also fine when the canvas never said ready', async () => {
    const { open } = await import('./harness');
    const h = open(PLAIN, deckText());
    await h.session.close();
    expect(h.editor.recorded()).toEqual([]);
  });
});

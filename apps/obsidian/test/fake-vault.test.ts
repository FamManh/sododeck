import { describe, expect, it } from 'vitest';

import type { VaultEvent } from '../src/ports';
import { FakeClock, FakeVault } from './fake-vault';

describe('FakeVault (the oracle for later tests)', () => {
  it('resolves links by full path, folder-relative path and shortest unique name', () => {
    const v = new FakeVault();
    v.seed('notes/deck.sododeck.md', '');
    v.seed('notes/img/a.png', new Uint8Array([1]));
    v.seed('other/b.png', new Uint8Array([2]));
    v.seed('c/b.png', new Uint8Array([3]));
    expect(v.resolveLink('notes/img/a.png', 'notes/deck.sododeck.md')).toBe('notes/img/a.png');
    expect(v.resolveLink('img/a.png', 'notes/deck.sododeck.md')).toBe('notes/img/a.png');
    expect(v.resolveLink('a.png', 'notes/deck.sododeck.md')).toBe('notes/img/a.png');
    expect(v.resolveLink('missing.png', 'notes/deck.sododeck.md')).toBeNull();
  });

  it('gives the attachment path from the setting with numbered de-duplication', async () => {
    const v = new FakeVault();
    v.attachments = { folder: 'attachments' };
    expect(await v.availablePath('x.png', 'n/d.md')).toBe('attachments/x.png');
    v.seed('attachments/x.png', new Uint8Array());
    expect(await v.availablePath('x.png', 'n/d.md')).toBe('attachments/x 1.png');
    v.attachments = 'same-folder';
    expect(await v.availablePath('x.png', 'n/d.md')).toBe('n/x.png');
    v.attachments = 'root';
    expect(await v.availablePath('x.png', 'n/d.md')).toBe('x.png');
  });

  it('writes emit modify, reject for missing files, and can be held', async () => {
    const v = new FakeVault();
    const events: VaultEvent[] = [];
    v.onChange((e) => events.push(e));
    await expect(v.writeText('gone.md', 'x')).rejects.toThrow(/not found/i);
    v.seed('a.md', 'one');
    await v.writeText('a.md', 'two');
    expect(v.text('a.md')).toBe('two');
    expect(events).toEqual([{ kind: 'modify', path: 'a.md' }]);
    v.holdWrites = true;
    const pending = v.writeText('a.md', 'three');
    expect(v.writesWaiting).toBe(1);
    expect(v.text('a.md')).toBe('two');
    v.releaseWrites();
    await pending;
    expect(v.text('a.md')).toBe('three');
  });

  it('rewrites links in notes when a file moves and the switch is on', () => {
    const v = new FakeVault();
    v.seed('n/deck.md', '- [[a.png]] %%id%%');
    v.seed('a.png', new Uint8Array([1]));
    const events: VaultEvent[] = [];
    v.onChange((e) => events.push(e));
    v.externalRename('a.png', 'pics/a.png');
    expect(v.text('n/deck.md')).toBe('- [[a.png]] %%id%%');
    v.seed('n/deck.md', '- [[pics/a 1.png]]');
    v.updateLinksOnRename = false;
    v.externalRename('pics/a.png', 'z/a.png');
    expect(events.filter((e) => e.kind === 'modify')).toEqual([]);
  });

  it('fake clock runs timers in order and cancels', () => {
    const c = new FakeClock();
    const fired: string[] = [];
    c.setTimeout(() => fired.push('b'), 20);
    c.setTimeout(() => fired.push('a'), 10);
    const cancel = c.setTimeout(() => fired.push('x'), 15);
    cancel();
    c.advance(30);
    expect(fired).toEqual(['a', 'b']);
  });
});

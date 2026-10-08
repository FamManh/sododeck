import { inspectDeckText } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import {
  copyAsSododeck,
  createNewDeck,
  deckJsonFiles,
  newDeckPath,
  newDeckText,
} from '../src/commands';
import { FakeVault } from './fake-vault';

const NOW = new Date('2026-10-07T22:30:15.123Z');

function vaultOf(fake: FakeVault) {
  return {
    exists: (p: string) => fake.exists(p),
    createText: (p: string, t: string) => {
      fake.seed(p, t);
      return Promise.resolve();
    },
  };
}

describe('New Sododeck (US6)', () => {
  it('names the file Sodo deck <date> <hh-mm>.sododeck in the chosen folder, or the root', () => {
    expect(newDeckPath('', () => false, NOW)).toBe('Sodo deck 2026-10-07 22-30.sododeck');
    expect(newDeckPath('notes/a', () => false, NOW)).toBe(
      'notes/a/Sodo deck 2026-10-07 22-30.sododeck',
    );
  });

  it('has no character a file name cannot hold', () => {
    expect(newDeckPath('', () => false, NOW)).not.toMatch(/[:*?"<>|\\]/);
  });

  it('numbers a taken name and never overwrites', async () => {
    const fake = new FakeVault();
    const vault = vaultOf(fake);
    const first = await createNewDeck(vault, 'n', NOW);
    const second = await createNewDeck(vault, 'n', NOW);
    expect([first, second]).toEqual([
      'n/Sodo deck 2026-10-07 22-30.sododeck',
      'n/Sodo deck 2026-10-07 22-30 1.sododeck',
    ]);
    expect(fake.paths()).toHaveLength(2);
  });

  it('writes a valid, empty deck', () => {
    expect(inspectDeckText(newDeckText()).ok).toBe(true);
  });
});

describe('Copy JSON deck as a deck file (071 US2)', () => {
  const deck = newDeckText();

  function copyVault(fake: FakeVault) {
    return { ...vaultOf(fake), readText: (p: string) => fake.readText(p) };
  }

  it('writes <name>.sododeck with the same text and leaves the original', async () => {
    const fake = new FakeVault();
    fake.seed('a/old.sododeck.json', deck);
    const result = await copyAsSododeck(copyVault(fake), 'a/old.sododeck.json');
    expect(result).toEqual({ ok: true, path: 'a/old.sododeck' });
    expect(fake.text('a/old.sododeck')).toBe(deck);
    expect(fake.text('a/old.sododeck.json')).toBe(deck);
  });

  it('never overwrites: a taken name gets a number', async () => {
    const fake = new FakeVault();
    fake.seed('old.sododeck.json', deck);
    fake.seed('old.sododeck', 'mine');
    const result = await copyAsSododeck(copyVault(fake), 'old.sododeck.json');
    expect(result).toEqual({ ok: true, path: 'old 1.sododeck' });
    expect(fake.text('old.sododeck')).toBe('mine');
  });

  it('refuses a file that is not a deck, writing nothing', async () => {
    const fake = new FakeVault();
    fake.seed('x.sododeck.json', 'just text');
    const result = await copyAsSododeck(copyVault(fake), 'x.sododeck.json');
    expect(result).toEqual({ ok: false, reason: 'not a Sododeck deck' });
    expect(fake.paths()).toEqual(['x.sododeck.json']);
  });

  it('reports a write failure with its reason', async () => {
    const fake = new FakeVault();
    fake.seed('x.sododeck.json', deck);
    const vault = {
      ...copyVault(fake),
      createText: () => Promise.reject(new Error('disk full')),
    };
    const result = await copyAsSododeck(vault, 'x.sododeck.json');
    expect(result).toEqual({ ok: false, reason: 'could not write: disk full' });
  });

  it('lists only vault files ending .sododeck.json', () => {
    expect(
      deckJsonFiles(['a.md', 'b.sododeck.json', 'c/d.SODODECK.JSON', 'e.sododeck', 'f.json']),
    ).toEqual(['b.sododeck.json', 'c/d.SODODECK.JSON']);
  });
});

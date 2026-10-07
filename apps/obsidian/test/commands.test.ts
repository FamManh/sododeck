import { inspectDeckText } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { createNewDeck, newDeckPath, newDeckText } from '../src/commands';
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
  it('names the file Sodo deck <ISO time>.sododeck in the chosen folder, or the root', () => {
    expect(newDeckPath('', () => false, NOW)).toBe('Sodo deck 2026-10-07T22-30-15.sododeck');
    expect(newDeckPath('notes/a', () => false, NOW)).toBe(
      'notes/a/Sodo deck 2026-10-07T22-30-15.sododeck',
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
      'n/Sodo deck 2026-10-07T22-30-15.sododeck',
      'n/Sodo deck 2026-10-07T22-30-15 1.sododeck',
    ]);
    expect(fake.paths()).toHaveLength(2);
  });

  it('writes a valid, empty deck', () => {
    expect(inspectDeckText(newDeckText()).ok).toBe(true);
  });
});

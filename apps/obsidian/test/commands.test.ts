import { isDeckMarkdown, inspectDeckText, fromMarkdown } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { createNewDeck, newDeckPath, newDeckText } from '../src/commands';
import { FakeVault } from './fake-vault';

function vaultOf(fake: FakeVault) {
  return {
    exists: (p: string) => fake.exists(p),
    createText: (p: string, t: string) => {
      fake.seed(p, t);
      return Promise.resolve();
    },
  };
}

describe('New Sododeck deck (US6)', () => {
  it('names the file in the chosen folder, or the root', () => {
    expect(newDeckPath('', () => false)).toBe('Untitled deck.sododeck.md');
    expect(newDeckPath('notes/a', () => false)).toBe('notes/a/Untitled deck.sododeck.md');
  });

  it('numbers the name while it is taken and never overwrites', async () => {
    const fake = new FakeVault();
    const vault = vaultOf(fake);
    const first = await createNewDeck(vault, 'n');
    const second = await createNewDeck(vault, 'n');
    const third = await createNewDeck(vault, 'n');
    expect([first, second, third]).toEqual([
      'n/Untitled deck.sododeck.md',
      'n/Untitled deck 1.sododeck.md',
      'n/Untitled deck 2.sododeck.md',
    ]);
    expect(fake.paths()).toHaveLength(3);
  });

  it('writes a valid deck note that opens as a deck', () => {
    const text = newDeckText();
    expect(isDeckMarkdown(text)).toBe(true);
    const read = fromMarkdown(text);
    expect(read.ok).toBe(true);
    if (read.ok) expect(inspectDeckText(read.deckText).ok).toBe(true);
  });
});

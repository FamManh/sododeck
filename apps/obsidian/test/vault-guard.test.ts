import { describe, expect, it } from 'vitest';

import { basename, dirname, joinInVault, OUTSIDE_VAULT } from '../src/vault-guard';

describe('joinInVault', () => {
  it('joins inside the vault', () => {
    expect(joinInVault('notes/deck', 'a.png')).toEqual({ ok: true, path: 'notes/deck/a.png' });
    expect(joinInVault('notes/deck', '../img/a.png')).toEqual({
      ok: true,
      path: 'notes/img/a.png',
    });
    expect(joinInVault('', 'a/b.png')).toEqual({ ok: true, path: 'a/b.png' });
    expect(joinInVault('a', '../b.png')).toEqual({ ok: true, path: 'b.png' });
  });

  it('refuses a path that leaves the vault', () => {
    expect(joinInVault('a', '../../x.png')).toEqual({ ok: false, reason: OUTSIDE_VAULT });
    expect(joinInVault('', '../x.png')).toEqual({ ok: false, reason: OUTSIDE_VAULT });
    expect(joinInVault('a/b', '../../../x.png')).toEqual({ ok: false, reason: OUTSIDE_VAULT });
  });

  it('refuses absolute paths, drives, schemes, backslashes, inner parents and empties with a reason', () => {
    for (const bad of [
      '/etc/x',
      'C:\\x',
      'C:/x',
      'file:///x',
      'a\\b.png',
      'a/../b.png',
      '',
      'a//b.png',
    ]) {
      const result = joinInVault('d', bad);
      expect(result.ok, bad).toBe(false);
      if (!result.ok) expect(result.reason.length, bad).toBeGreaterThan(5);
    }
  });
});

describe('names', () => {
  it('splits a vault path', () => {
    expect(dirname('a/b/c.md')).toBe('a/b');
    expect(dirname('c.md')).toBe('');
    expect(basename('a/b/c.md')).toBe('c.md');
    expect(basename('c.md')).toBe('c.md');
  });
});

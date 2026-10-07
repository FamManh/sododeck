import { describe, expect, it } from 'vitest';

import { resolveInside } from '../src/workspace-guard';
import { makeFakes } from './fakes';

const DECK = 'file:///ws/docs/arch.sododeck';

function setup() {
  const fakes = makeFakes({ folders: ['file:///ws'] });
  fakes.files.set(DECK, '{}');
  return { fakes, ports: { files: fakes.files, workspace: fakes.workspace } };
}

describe('resolveInside', () => {
  it('accepts a picture next to the deck and one reached through ".." inside the workspace', async () => {
    const { ports } = setup();
    expect(await resolveInside(DECK, 'arch.assets/a.png', ports)).toEqual({
      ok: true,
      loc: 'file:///ws/docs/arch.assets/a.png',
    });
    expect(await resolveInside(DECK, '../shared/a.png', ports)).toEqual({
      ok: true,
      loc: 'file:///ws/shared/a.png',
    });
  });

  it('refuses ".." runs that leave the workspace', async () => {
    const { ports } = setup();
    for (const rel of ['../../etc/a.png', '../../../a.png']) {
      expect(await resolveInside(DECK, rel, ports)).toEqual({
        ok: false,
        reason: 'outside the workspace',
      });
    }
  });

  it('refuses paths the picture rule rejects: absolute, Windows separators, drive letters', async () => {
    const { ports } = setup();
    for (const rel of ['/etc/passwd', '..\\..\\a.png', 'C:/a.png', 'a/../b.png', '']) {
      const result = await resolveInside(DECK, rel, ports);
      expect(result.ok, rel).toBe(false);
    }
  });

  it('refuses a link inside the workspace that points out', async () => {
    const { fakes, ports } = setup();
    fakes.files.links.set('file:///ws/docs/out', 'file:///secret');
    fakes.files.set('file:///secret/a.png', 'x');
    expect(await resolveInside(DECK, 'out/a.png', ports)).toEqual({
      ok: false,
      reason: 'outside the workspace',
    });
  });

  it('checks a not-yet-existing target through its nearest existing parent', async () => {
    const { fakes, ports } = setup();
    fakes.files.links.set('file:///ws/docs/out', 'file:///secret');
    fakes.files.folders.add('file:///secret');
    expect((await resolveInside(DECK, 'out/new/a.png', ports)).ok).toBe(false);
    expect((await resolveInside(DECK, 'new-folder/a.png', ports)).ok).toBe(true);
  });

  it('lets a deck outside every workspace reach only its own folder', async () => {
    const { fakes, ports } = setup();
    const loose = 'file:///elsewhere/notes/x.sododeck';
    fakes.files.set(loose, '{}');
    expect((await resolveInside(loose, 'x.assets/a.png', ports)).ok).toBe(true);
    expect((await resolveInside(loose, '../other/a.png', ports)).ok).toBe(false);
    expect((await resolveInside(loose, '../../ws/a.png', ports)).ok).toBe(false);
  });

  it('judges a symlinked deck folder by the folder it really is', async () => {
    const { fakes, ports } = setup();
    fakes.files.links.set('file:///ws/linked', 'file:///outside/real');
    fakes.files.set('file:///outside/real/d.sododeck', '{}');
    const deck = 'file:///ws/linked/d.sododeck';
    expect((await resolveInside(deck, 'd.assets/a.png', ports)).ok).toBe(true);
    expect((await resolveInside(deck, '../a.png', ports)).ok).toBe(false);
  });

  it('ignores letter case on a case-insensitive file system', async () => {
    const { fakes, ports } = setup();
    fakes.files.caseInsensitive = true;
    const result = await resolveInside('file:///WS/docs/arch.sododeck', 'arch.assets/a.png', ports);
    expect(result.ok).toBe(true);
  });

  it('judges other schemes lexically', async () => {
    const fakes = makeFakes({ folders: ['vscode-vfs://host/repo'] });
    const ports = { files: fakes.files, workspace: fakes.workspace };
    const deck = 'vscode-vfs://host/repo/docs/a.sododeck';
    expect((await resolveInside(deck, 'a.assets/p.png', ports)).ok).toBe(true);
    expect((await resolveInside(deck, '../../other/p.png', ports)).ok).toBe(false);
  });
});

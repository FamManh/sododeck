import { describe, expect, it } from 'vitest';

import { handleExportFile, handleOpenLink } from '../src/host-links-exports';
import { makeFakes } from './fakes';

const DECK = 'file:///ws/docs/arch.sododeck';

describe('open-link', () => {
  it('sends web links to the browser', async () => {
    const fakes = makeFakes();
    await handleOpenLink(
      { type: 'open-link', href: 'https://example.com/a?b=1#c' },
      DECK,
      false,
      fakes,
    );
    await handleOpenLink({ type: 'open-link', href: 'http://example.com' }, DECK, false, fakes);
    expect(fakes.ui.external).toEqual(['https://example.com/a?b=1#c', 'http://example.com']);
    expect(fakes.ui.opened).toEqual([]);
  });

  it('opens a relative link inside the workspace, against the deck folder', async () => {
    const fakes = makeFakes();
    await handleOpenLink({ type: 'open-link', href: './notes/a%20b.md#top' }, DECK, false, fakes);
    await handleOpenLink({ type: 'open-link', href: '../README.md' }, DECK, false, fakes);
    expect(fakes.ui.opened).toEqual(['file:///ws/docs/notes/a b.md', 'file:///ws/README.md']);
  });

  it('refuses a relative link that leaves the workspace', async () => {
    const fakes = makeFakes();
    await handleOpenLink({ type: 'open-link', href: '../../etc/passwd' }, DECK, false, fakes);
    expect(fakes.ui.opened).toEqual([]);
    expect(fakes.ui.notices.join('\n')).toContain('outside the workspace');
  });

  it('refuses other schemes and absolute paths', async () => {
    const fakes = makeFakes();
    for (const href of [
      'javascript:alert(1)',
      'file:///etc/passwd',
      'vscode://x',
      '/etc/passwd',
      '//evil.test/x',
    ]) {
      await handleOpenLink({ type: 'open-link', href }, DECK, false, fakes);
    }
    expect(fakes.ui.external).toEqual([]);
    expect(fakes.ui.opened).toEqual([]);
  });

  it('asks to save an untitled deck before a relative link can open', async () => {
    const fakes = makeFakes();
    await handleOpenLink({ type: 'open-link', href: 'a.md' }, 'untitled:Untitled-1', true, fakes);
    expect(fakes.ui.opened).toEqual([]);
    expect(fakes.ui.notices).toHaveLength(1);
  });
});

describe('export-file', () => {
  const bytes = new Uint8Array([1, 2, 3]);

  it('writes the bytes to the chosen location', async () => {
    const fakes = makeFakes();
    fakes.ui.saveChoice = 'file:///ws/out/pic.png';
    await handleExportFile(
      { type: 'export-file', name: 'pic.png', mime: 'image/png', bytes },
      DECK,
      false,
      fakes,
    );
    expect(fakes.ui.saveDialogs).toEqual([{ name: 'pic.png', folder: 'file:///ws/docs' }]);
    expect([...(fakes.files.data.get('file:///ws/out/pic.png') ?? [])]).toEqual([1, 2, 3]);
  });

  it('writes nothing when the dialog is cancelled', async () => {
    const fakes = makeFakes();
    await handleExportFile(
      { type: 'export-file', name: 'pic.png', mime: 'image/png', bytes },
      DECK,
      false,
      fakes,
    );
    expect(fakes.files.writes).toEqual([]);
  });

  it('cleans the suggested name and reports a failed write', async () => {
    const fakes = makeFakes();
    fakes.ui.saveChoice = 'file:///ws/out/x.png';
    fakes.files.failWrites.add('file:///ws/out/x.png');
    await handleExportFile(
      { type: 'export-file', name: '../a/b.png', mime: 'image/png', bytes },
      DECK,
      false,
      fakes,
    );
    expect(fakes.ui.saveDialogs[0]?.name).toBe('..-a-b.png');
    expect(fakes.ui.warnings).toHaveLength(1);
  });
});

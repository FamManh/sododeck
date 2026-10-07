import { describe, expect, it } from 'vitest';

import { writeDeckFile } from '../src/file-writer';
import { makeFakes } from './fakes';

const LOC = 'file:///ws/docs/arch.sododeck';

describe('writeDeckFile', () => {
  it('writes a temp sibling and renames it over a regular file', async () => {
    const { files } = makeFakes();
    files.set(LOC, 'old');
    await writeDeckFile(files, LOC, 'new');
    expect(files.get(LOC)).toBe('new');
    expect(files.renames).toHaveLength(1);
    expect(files.renames[0]?.to).toBe(LOC);
    expect(files.renames[0]?.from).toMatch(
      /^file:\/\/\/ws\/docs\/\.arch\.sododeck\.[0-9a-f]{8}\.tmp$/,
    );
    expect([...files.data.keys()]).toEqual([LOC]);
  });

  it('writes in place through a symlink, so the link stays a link', async () => {
    const { files } = makeFakes();
    files.set('file:///real/arch.sododeck', 'old');
    files.links.set(LOC, 'file:///real/arch.sododeck');
    await writeDeckFile(files, LOC, 'new');
    expect(files.get('file:///real/arch.sododeck')).toBe('new');
    expect(files.renames).toEqual([]);
    expect(files.links.has(LOC)).toBe(true);
  });

  it('writes directly on other schemes', async () => {
    const { files } = makeFakes();
    const loc = 'vscode-vfs://host/repo/a.sododeck';
    await writeDeckFile(files, loc, 'text');
    expect(files.get(loc)).toBe('text');
    expect(files.renames).toEqual([]);
  });

  it('creates a file that does not exist yet', async () => {
    const { files } = makeFakes();
    await writeDeckFile(files, LOC, 'first');
    expect(files.get(LOC)).toBe('first');
  });

  it.each(['write', 'rename'])(
    'leaves the original and no temp file when the %s fails',
    async (step) => {
      const { files } = makeFakes();
      files.set(LOC, 'old');
      if (step === 'rename') files.failRenames = true;
      else {
        const original = files.write.bind(files);
        files.write = async (loc, bytes) => {
          if (loc.endsWith('.tmp')) throw new Error('disk full');
          await original(loc, bytes);
        };
      }
      await expect(writeDeckFile(files, LOC, 'new')).rejects.toThrow(
        /Could not save arch.sododeck/,
      );
      expect(files.get(LOC)).toBe('old');
      expect([...files.data.keys()]).toEqual([LOC]);
    },
  );

  it('says why a direct write failed', async () => {
    const { files } = makeFakes();
    const loc = 'vscode-vfs://host/repo/a.sododeck';
    files.failWrites.add(loc);
    await expect(writeDeckFile(files, loc, 'x')).rejects.toThrow(/EACCES/);
  });
});

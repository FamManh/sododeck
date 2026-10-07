import type { FilePort, Loc } from './ports';

const encoder = new TextEncoder();

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

/**
 * Writes the deck file (R7). On the `file` scheme a regular file is replaced through a temp
 * sibling and a rename, so a crash or a full disk leaves the old file intact; a symlinked target
 * is written in place (a rename would replace the link itself); other schemes write directly.
 * On failure the original is untouched, no temp file is left, and the error says why.
 */
export async function writeDeckFile(files: FilePort, loc: Loc, text: string): Promise<void> {
  const bytes = encoder.encode(text);
  if (files.scheme(loc) !== 'file' || (await files.isSymlink(loc))) {
    try {
      await files.write(loc, bytes);
    } catch (error) {
      throw new Error(`Could not save ${files.basename(loc)}: ${reasonOf(error)}`, {
        cause: error,
      });
    }
    return;
  }
  const suffix = globalThis.crypto.randomUUID().slice(0, 8);
  const temp = files.join(files.dirname(loc), `.${files.basename(loc)}.${suffix}.tmp`);
  try {
    await files.write(temp, bytes);
    await files.rename(temp, loc);
  } catch (error) {
    try {
      await files.remove(temp);
    } catch {
      // The temp file may not exist (the write failed first); nothing more to clean.
    }
    throw new Error(`Could not save ${files.basename(loc)}: ${reasonOf(error)}`, { cause: error });
  }
}

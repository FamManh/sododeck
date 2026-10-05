/**
 * Copies the AI deck skill archive (027) into `public/downloads/` before the site builds, so the
 * docs page offers exactly the skill this commit builds. Turbo builds `@sododeck/skill` first (it
 * is a devDependency). `--optional` (dev server) skips quietly when the archive is not built yet.
 */
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const optional = process.argv.includes('--optional');
const source = fileURLToPath(import.meta.resolve('@sododeck/skill/dist/sododeck-deck.zip'));
const target = fileURLToPath(new URL('../public/downloads/sododeck-deck.zip', import.meta.url));

try {
  await mkdir(fileURLToPath(new URL('../public/downloads/', import.meta.url)), { recursive: true });
  await copyFile(source, target);
} catch (error) {
  if (!optional) {
    process.stderr.write(
      `Cannot copy the AI deck skill archive (run \`pnpm --filter @sododeck/skill build\`): ${String(error)}\n`,
    );
    process.exit(1);
  }
}

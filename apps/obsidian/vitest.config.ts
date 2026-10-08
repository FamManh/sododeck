import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// The real `obsidian` package is types only and the inlined page exists only after a build, so
// tests that reach the glue use stand-ins.
export default defineConfig({
  resolve: {
    alias: {
      obsidian: fileURLToPath(new URL('./test/fake-obsidian.ts', import.meta.url)),
      'embed:single': fileURLToPath(new URL('./test/stub-embed.ts', import.meta.url)),
    },
  },
  test: { include: ['test/**/*.test.ts'] },
});

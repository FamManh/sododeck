import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** The app's version for the `ready` message and copied problem reports. */
const appVersion = (
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

/**
 * The embeddable editor (067 R1): a second entry of this app, built on its own so it carries no
 * library, offline cache or telemetry. `base: './'` because hosts load it from places that are not
 * a web root (`vscode-webview://…`, `app://…`). No PWA plugin: it would register a service worker.
 * `scripts/check-embed-bundle.mjs` fails the build when code that must stay out gets in.
 */
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  plugins: [react(), tailwindcss()],
  resolve: {
    // No dynamic `<script>` injection in the embed (hosts reject it): see the shim.
    alias: {
      '@monaco-editor/loader': fileURLToPath(
        new URL('./src/embed/monaco-loader-shim.ts', import.meta.url),
      ),
    },
  },
  worker: { format: 'es' },
  build: {
    outDir: 'dist-embed',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    rollupOptions: { input: 'embed.html' },
  },
});

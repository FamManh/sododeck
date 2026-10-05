import { readFileSync } from 'node:fs';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** The app's version for copied problem reports (062 R11): `app` in the report. */
const appVersion = (
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Offline after first load: precache the whole app shell, including Monaco and fonts.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,webmanifest}'],
        // Telemetry SDKs load only when enabled; don't make every user download them.
        globIgnores: ['**/sentry-*.js', '**/posthog-*.js'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
      },
      manifest: {
        name: 'Sododeck',
        short_name: 'Sododeck',
        description: 'Interactive, editable architecture and flow diagrams.',
        theme_color: '#fafaf8',
        background_color: '#fafaf8',
        display: 'standalone',
        // TODO(M5): PNG icons (192/512 + maskable) via @vite-pwa/assets-generator.
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
    }),
  ],
  worker: { format: 'es' },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  // Closed source: no public sourcemaps. TODO(M5): 'hidden' maps uploaded to Sentry, then deleted.
  build: { target: 'es2022', sourcemap: false },
});

import { defineConfig } from 'vitest/config';

// jsdom: the window transports need `window`, `MessageEvent` and `postMessage`.
export default defineConfig({ test: { environment: 'jsdom', include: ['test/**/*.test.ts'] } });

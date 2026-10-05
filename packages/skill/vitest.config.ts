import { defineConfig } from 'vitest/config';

// The build test bundles the skill and runs its scripts in child processes.
export default defineConfig({ test: { include: ['test/**/*.test.ts'], testTimeout: 60_000 } });

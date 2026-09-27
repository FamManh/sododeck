import type { AppEnv } from '../lib/env';

/**
 * Loads telemetry SDKs only when enabled (they are separate chunks and never
 * downloaded otherwise). Rule 5: telemetry must never carry diagram content.
 */
export async function initTelemetry(env: AppEnv): Promise<void> {
  const tasks: Promise<void>[] = [];
  if (env.sentry.enabled) {
    const { dsn } = env.sentry;
    tasks.push(
      import('./sentry').then((m) => {
        m.initSentry(dsn);
      }),
    );
  }
  if (env.posthog.enabled) {
    const { key, host } = env.posthog;
    tasks.push(
      import('./posthog').then((m) => {
        m.initPostHog(key, host);
      }),
    );
  }
  await Promise.allSettled(tasks);
}

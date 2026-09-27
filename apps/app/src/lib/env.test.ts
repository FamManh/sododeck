import { describe, expect, it } from 'vitest';

import { readEnv } from './env';

describe('readEnv', () => {
  it('disables all telemetry by default', () => {
    expect(readEnv({})).toEqual({ sentry: { enabled: false }, posthog: { enabled: false } });
  });

  it('requires both the flag and a key', () => {
    expect(readEnv({ VITE_SENTRY_ENABLED: 'true' }).sentry.enabled).toBe(false);
    expect(readEnv({ VITE_SENTRY_DSN: 'https://x@sentry.io/1' }).sentry.enabled).toBe(false);
    expect(readEnv({ VITE_POSTHOG_ENABLED: '1', VITE_POSTHOG_KEY: 'phc_x' }).posthog.enabled).toBe(
      false,
    );
  });

  it('enables when configured', () => {
    expect(
      readEnv({
        VITE_SENTRY_ENABLED: 'true',
        VITE_SENTRY_DSN: 'https://x@sentry.io/1',
        VITE_POSTHOG_ENABLED: 'true',
        VITE_POSTHOG_KEY: 'phc_x',
      }),
    ).toEqual({
      sentry: { enabled: true, dsn: 'https://x@sentry.io/1' },
      posthog: { enabled: true, key: 'phc_x', host: 'https://eu.i.posthog.com' },
    });
  });
});

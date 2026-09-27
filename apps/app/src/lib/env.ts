export interface AppEnv {
  sentry: { enabled: false } | { enabled: true; dsn: string };
  posthog: { enabled: false } | { enabled: true; key: string; host: string };
}

type RawEnv = Partial<Record<keyof ImportMetaEnv, string>>;

/** Telemetry is enabled only when its flag is exactly "true" AND a key is present. */
export function readEnv(raw: RawEnv = import.meta.env): AppEnv {
  const dsn = raw.VITE_SENTRY_DSN?.trim();
  const key = raw.VITE_POSTHOG_KEY?.trim();
  return {
    sentry: raw.VITE_SENTRY_ENABLED === 'true' && dsn ? { enabled: true, dsn } : { enabled: false },
    posthog:
      raw.VITE_POSTHOG_ENABLED === 'true' && key
        ? { enabled: true, key, host: raw.VITE_POSTHOG_HOST?.trim() || 'https://eu.i.posthog.com' }
        : { enabled: false },
  };
}

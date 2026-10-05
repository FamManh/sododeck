interface ImportMetaEnv {
  readonly VITE_SENTRY_ENABLED?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_POSTHOG_ENABLED?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Vite asset URL imports (`?url`), e.g. the ELK worker script. */
declare module '*?url' {
  const url: string;
  export default url;
}

/** `apps/app/package.json` version, set by Vite `define` (062 R11). */
declare const __APP_VERSION__: string;

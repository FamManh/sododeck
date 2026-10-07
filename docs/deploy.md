# Deploying to Cloudflare Pages

Two Pages projects, one per app. Both build from the **repo root** so pnpm workspaces resolve. Nothing is deployed automatically yet. These are the steps for the first deploy.

| Project         | Domain           | Build command                                  | Output dir       | Watch paths                                                              |
| --------------- | ---------------- | ---------------------------------------------- | ---------------- | ------------------------------------------------------------------------ |
| `sododeck-app`  | app.sododeck.com | `pnpm turbo run build --filter=@sododeck/app`  | `apps/app/dist`  | `apps/app/**`, `packages/**`, `pnpm-lock.yaml`                           |
| `sododeck-site` | sododeck.com     | `pnpm turbo run build --filter=@sododeck/site` | `apps/site/dist` | `apps/site/**`, `packages/ui/**`, `packages/config/**`, `pnpm-lock.yaml` |

## What is already in the repo

- `apps/app/public/_redirects`: SPA fallback (`/* /index.html 200`), so deep links like `/deck/abc` load the app. Static files are matched first.
- `apps/*/public/_headers`: security headers, plus immutable caching for hashed assets. `index.html`, `sw.js` and the manifest are `no-cache` so a new deploy is picked up (the service worker then updates itself: `registerType: 'autoUpdate'`).
- `apps/*/wrangler.toml`: project name and output dir, used by direct uploads with `wrangler pages deploy`. Git-integrated builds ignore it (their root dir is the repo root).
- Sourcemaps are **off** in production builds (closed source).

## One-time setup (dashboard, Git integration)

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick this repo.
2. Create `sododeck-app`:
   - Production branch: `main`
   - Framework preset: None
   - Root directory: `/` (repo root)
   - Build command / output directory: from the table above
   - Environment variables (Production and Preview):
     - `NODE_VERSION` = `24`
     - `PNPM_VERSION` = `10.34.5` (keep in sync with `packageManager` in `package.json`)
     - Telemetry, only when you decide to turn it on: `VITE_SENTRY_ENABLED`, `VITE_SENTRY_DSN`, `VITE_POSTHOG_ENABLED`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`. They are build-time values baked into the public bundle; leave them unset to keep telemetry off.
   - Settings → Builds → Build watch paths: include the paths from the table so site-only commits don't rebuild the app.
3. Create `sododeck-site` the same way with its row from the table (only `NODE_VERSION`, `PNPM_VERSION`, and optionally `PUBLIC_APP_URL`).
4. Custom domains: add `app.sododeck.com` to `sododeck-app` and `sododeck.com` (+ `www.sododeck.com` → redirect to the apex via a Redirect Rule) to `sododeck-site`. DNS must be on Cloudflare, or add the CNAMEs it shows.
5. Every branch/PR gets a preview URL (`<branch>.sododeck-app.pages.dev`). For site previews that should link to the matching app preview, set `PUBLIC_APP_URL` in the Preview environment.

## Alternative: direct upload from a machine or CI

```bash
pnpm turbo run build --filter=@sododeck/app
cd apps/app && pnpm dlx wrangler pages deploy        # uses wrangler.toml
```

Deploying from GitHub Actions instead needs a `CLOUDFLARE_API_TOKEN` (Pages:Edit) and `CLOUDFLARE_ACCOUNT_ID` secret. Not set up; decide before adding it.

## VS Code extension

The extension (`apps/vscode`) is released separately from the web app; see `docs/release/vscode-extension.md`.

## Verify after the first deploy

- `https://app.sododeck.com/deck/demo` (deep link) loads the editor, and a hard refresh still works.
- DevTools → Application → Service Workers shows `sw.js` active. Go offline and reload: the app still loads.
- DevTools → Network: no requests to third-party origins (telemetry off).
- `https://sododeck.com/docs` and `/blog/hello-world` load.
- `https://sododeck.com/schema/v1.json` returns the schema as `application/schema+json` with `Access-Control-Allow-Origin: *`.

## Open items

- PWA icons: only an SVG icon today. Add 192/512 PNG + maskable before promoting installability.
- Content-Security-Policy header: not set yet. Add once Monaco's worker/blob and style needs are pinned down (and telemetry hosts, if enabled).

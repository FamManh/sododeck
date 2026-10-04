# Sododeck

Interactive, editable architecture & flow diagrams: a canvas and a JSON model in two-way sync. Local-first, no account.

- **Editor:** `apps/app` → app.sododeck.com
- **Website:** `apps/site` → sododeck.com

Private repository. See [`docs/spec.md`](docs/spec.md) for the product spec and [`AGENTS.md`](AGENTS.md) for architecture rules and conventions.

## Requirements

- Node.js 24+ (`.nvmrc`; e.g. `fnm use` / `nvm use`)
- pnpm via Corepack: `corepack enable` (the version is pinned in `package.json`)

## Setup

```bash
corepack enable
pnpm install
pnpm dev          # app → http://localhost:5173, site → http://localhost:4321
```

Optional telemetry config: copy `apps/app/.env.example` to `apps/app/.env.local`. Everything is off by default.

For e2e tests, install Chromium once: `pnpm --filter @sododeck/app exec playwright install chromium`.

## Commands

| Command                | Description                                            |
| ---------------------- | ------------------------------------------------------ |
| `pnpm dev`             | Run the app and the site in dev mode                   |
| `pnpm build`           | Build all apps (Turborepo, cached)                     |
| `pnpm test`            | Unit tests (Vitest)                                    |
| `pnpm e2e`             | Playwright smoke tests against the production build    |
| `pnpm lint`            | ESLint + Prettier check                                |
| `pnpm typecheck`       | TypeScript / Astro checks                              |
| `pnpm format`          | Format with Prettier                                   |
| `pnpm bench`           | Canvas performance benchmark (500 nodes / 1,000 edges) |
| `pnpm schema:generate` | Regenerate TS types + Zod from the JSON Schema         |
| `pnpm icons:generate`  | Regenerate the icon geometry + third-party notice      |

Commits follow [Conventional Commits](https://www.conventionalcommits.org/). A pre-commit hook runs ESLint + Prettier on staged files, and commitlint checks the message.

## Structure

```
apps/app          Vite + React editor (React Flow, Yjs, Monaco, Zustand, PWA)
apps/site         Astro site (MDX docs/blog)
packages/schema   .sododeck.json JSON Schema v1, generated types, Zod validators
packages/model    Yjs document model and JSON import/export
packages/ui       Design tokens, Tailwind v4 theme, shared components
packages/config   Shared tsconfig / ESLint / Prettier
docs/             Spec, ADRs (docs/decisions), deploy guide
```

## Deploy

Cloudflare Pages, one project per app. See [`docs/deploy.md`](docs/deploy.md).

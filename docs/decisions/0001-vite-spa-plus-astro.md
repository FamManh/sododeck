# 0001. Vite SPA for the editor, Astro for the website

- **Status:** Accepted
- **Date:** 2026-09-27

## Context

Sododeck has two very different surfaces:

1. **The editor**: a heavy, fully client-side, local-first app (React Flow canvas, Yjs, Monaco, IndexedDB, Web Workers). It has no backend in the MVP, must work offline after first load (PWA), and must never send diagram content over the network. SEO is irrelevant; startup and interaction performance matter.
2. **The website**: landing page, docs, blog, legal pages, later templates. It is content-heavy, SEO-critical, and should ship almost no JavaScript.

One founder working with AI agents maintains both, so the stack must be simple, conventional and well-documented.

## Decision

- `apps/app`: **Vite + React SPA** with React Router (data mode), deployed as static files with an SPA fallback on Cloudflare Pages (`app.sododeck.com`).
- `apps/site`: **Astro** (static output) with MDX and optional React islands (`sododeck.com`).
- Both share design tokens and components through `packages/ui` and live in one **pnpm + Turborepo** monorepo.

## Alternatives considered

- **Next.js for both.** One framework, but the editor gains nothing from SSR/RSC. It would add a server runtime model (and the temptation to use it) to an app whose core promise is "no server". Static export works, but it fights the framework. For the site, Next ships more JS than Astro for content pages.
- **Single Astro project hosting the editor as one giant island.** Fewer apps, but mixes two build/perf profiles, complicates PWA scoping, and puts editor routing inside a content framework.
- **Vite for both (hand-rolled SSG for the site).** Reinvents MDX, content collections, sitemaps and SEO plumbing that Astro provides.

## Consequences

- The editor is a plain static bundle: trivially hostable, offline-capable, no server attack surface. Adding a backend later (V2 sync) is a separate service, not a framework migration.
- Two build tools (Vite, and Astro which itself uses Vite) share the same Tailwind v4 plugin and tokens, so the visual language stays consistent.
- Cross-surface features (e.g. embedding a live read-only deck in docs) need an explicit integration, such as an iframe to the app or a small shared viewer package. This is acceptable and deferred.
- Two Cloudflare Pages projects to configure (documented in `docs/deploy.md`).

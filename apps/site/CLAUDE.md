# @sododeck/site — marketing, docs, blog (sododeck.com)

Astro (static output) + Tailwind v4 + MDX. React islands allowed, but keep them rare: this site should ship almost no JS.

- `src/layouts/BaseLayout.astro` — header, footer, theme bootstrap. `ProseLayout.astro` — MDX pages (`layout:` frontmatter).
- `src/pages/` — `/`, `/docs`, `/blog`, `/privacy`, `/terms`. Everything is placeholder (lorem) for now.
- `src/components/` — React islands (`ThemeToggle` reuses `@sododeck/ui`'s Button).
- `src/styles/global.css` — imports `@sododeck/ui/styles.css` so tokens match the app.
- `src/site.ts` — `APP_URL` (override with `PUBLIC_APP_URL`).

## Boundaries

- No dependency on `@sododeck/model` or the editor. Link to the app; don't embed it.
- No analytics or third-party scripts without an explicit decision (and an update to /privacy).
- Privacy and terms pages are placeholders. **Real legal text must be reviewed before launch.**

## Commands

`pnpm dev` (4321) · `pnpm build` · `pnpm typecheck` (`astro check`) · `pnpm lint`

## TODO

Publish `packages/schema/schema/v1.json` at `/schema/v1.json` (the `$schema` URL) at build time.

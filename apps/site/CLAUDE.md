# @sododeck/site — marketing, docs, blog (sododeck.com)

Astro (static output) + Tailwind v4 + MDX. React islands allowed, but keep them rare: this site should ship almost no JS.

- `src/layouts/BaseLayout.astro` — header, footer, theme bootstrap. `ProseLayout.astro` — MDX pages (`layout:` frontmatter).
- `src/pages/` — `/` (the landing page), `/docs`, `/blog`, `/privacy`, `/terms`. Everything except `/` is placeholder (lorem) for now.
- `src/components/` — `ThemeToggle` (React island reusing `@sododeck/ui`'s Button) and `landing/`.
- `src/components/landing/` — the landing page (board `Sododeck Landing.dc.html`, `docs/design/claude-design-prompt-landing.md`). React components rendered to **static HTML at build time** (no `client:*`, no hydration). `deck/` holds the canvas primitives (Deck card, group, proxy, connector labels, step sticker, flow token, viewport, code pane, table / enum cards); one file per section visual. Visuals that the design draws differently per breakpoint render three variants inside `BreakpointViews` (CSS shows one).
- `src/lib/landing/` — pure, tested data and geometry: `checkout-deck.ts` (the sample deck, tables, code lines), `crops.ts` (smaller worlds with outside proxies), `geometry.ts` / `scene.ts` / `schema.ts` (card sizes, curves, arrow heads, crow's feet, column rows), `timeline.ts` (build-time `@keyframes`), `seek.ts` (Flows player steps), `copy.ts`, `tokens.ts` (CSS variables only, no raw colours).
- `src/scripts/landing-motion.ts` — plays the stages: `data-play` runs a stage's animations, `--sdl-seek` (seconds) shifts its timeline and `data-paused` holds it. Loops start at once, play-once stages at 35 % in view; Replay; the Flows player seeks (previous / next / segment, play / pause; under reduced motion it steps through still frames). Step logic is pure in `lib/landing/seek.ts`. Reduced motion or no JS keeps the final frame, which is each element's own inline style.
- `src/scripts/landing-controls.ts` — the code panel tabs (`role=tablist`, ← / → / Home / End) and picking a card in the Code section (`data-pick-root`, `data-pick`, lit `data-ref` lines).
- `src/styles/landing.css` — marketing buttons, stage gating, Replay. Breakpoints `tab` (700px) and `desk` (1280px) are in `global.css`; marketing type tokens (`text-marketing-*`) come from `@sododeck/ui`.
- `src/styles/global.css` — imports `@sododeck/ui/styles.css` so tokens match the app.
- `src/site.ts` — `APP_URL` (override with `PUBLIC_APP_URL`).
- `src/integrations/publish-schema.ts` — on build, copies `packages/schema/schema/v1.json` to `dist/schema/v1.json`, the `$schema` URL of every deck file (headers in `public/_headers`). A file copy, not an import; `turbo.json` lists the schema as a build input so the cache notices changes. Not served by `pnpm dev`.

## Boundaries

- No dependency on `@sododeck/model` or the editor. Link to the app; don't embed it. `/docs/ai-skill` is the AI skill's page (`SKILL_URL`, 027); the skill itself is published in its own public repository (`SKILL_REPO_URL`, ADR 0042), so the site no longer builds or hosts a download.
- No analytics or third-party scripts without an explicit decision (and an update to /privacy).
- The landing page shows the Database pack (039–049), the AI skill (027) and the editable code panel (026) as shipped (decision L3): **do not deploy it before those are merged**.
- Privacy and terms pages are placeholders. **Real legal text must be reviewed before launch.**

## Commands

`pnpm dev` (4321) · `pnpm build` · `pnpm typecheck` (`astro check`) · `pnpm lint` · `pnpm test` (Vitest, jsdom)

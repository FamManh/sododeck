# Sododeck — agent rules

Rules for every AI agent working in this repo (Claude Code, Codex, others). `CLAUDE.md` only points here. Each app/package still has its own `CLAUDE.md` with its boundaries.

Interactive, editable architecture & flow diagram workspace. One model (nodes, edges, flows, steps, rules, notes, stickies, views) rendered as a **canvas + a JSON code panel kept in sync** (the panel is read-only for now; editing from JSON comes later, see `docs/backlog.md` 004).

- **MVP:** no login, no backend. Open the app and use it. Local-first: decks live in the browser (IndexedDB); export/import `.sododeck` (older `.sododeck.json` also opens).
- Global audience, English UI. Open source, MIT (see `LICENSE`).
- Team: one founder + AI agents. Code must be **simple, typed, well-tested, well-documented**.
- Product spec: `docs/spec.md`. Design system: `DESIGN.md`. Decisions: `docs/decisions/`. Deploy: `docs/deploy.md`.

## Repo map

```
apps/app/         Vite + React SPA, the editor → app.sododeck.com; also the "embed" build (`embed.html` → `dist-embed/`, storage-free, for host programs)
apps/vscode/        VS Code extension (a host): opens .sododeck as the canvas by loading the app's embed build → Marketplace
apps/obsidian/      Obsidian plugin (a host): opens .sododeck and .sododeck.md notes as the canvas in a sandboxed frame; the embed build is inlined into main.js → community plugin list
apps/site/        Astro marketing/docs/blog → sododeck.com
packages/schema/  JSON Schema v1 for .sododeck files → generated TS types + Zod
packages/model/   Yjs document model, the ONLY Yjs ↔ JSON conversion (also the `.sododeck.md` note form, pure text)
packages/host-protocol/  Messages between the embedded editor and a host program: Zod schemas, transports, scripted fake host (067)
packages/skill/   AI diagram skill (027): Markdown + bundled offline validate/lint → dist/sododeck-diagram/
packages/ui/      Design tokens, Tailwind v4 theme, shared React components (shadcn/ui, Radix, lucide)
packages/config/  Shared tsconfig, ESLint, Prettier
docs/             spec.md, decisions/ (ADRs), design/, deploy.md
.github/workflows CI
```

Each app/package has its own `CLAUDE.md` with its responsibility and boundaries. **Read it before changing that package.**

Dependency direction (never the reverse): `app → model → schema`, `app → host-protocol`, `vscode → host-protocol`, `vscode → model → schema`, `obsidian → host-protocol`, `obsidian → model → schema`, `skill → model → schema`, `app → ui`, `site → ui`, everything → `config`. The site only copies the skill's built archive (no code import). The extension only copies `apps/app`'s embed build (`dist-embed/` → `media/embed/`) and imports nothing from it. The Obsidian plugin likewise only inlines that build into `main.js` (`scripts/inline-embed.ts`).

## Commands (repo root)

| Command                | What                                                                        |
| ---------------------- | --------------------------------------------------------------------------- |
| `pnpm install`         | Install (pnpm version pinned via `packageManager`, Node ≥ 24, see `.nvmrc`) |
| `pnpm dev`             | App on :5173 + site on :4321                                                |
| `pnpm build`           | Build everything (turbo, cached)                                            |
| `pnpm test`            | Unit tests (Vitest) in all packages                                         |
| `pnpm e2e`             | Playwright smoke tests (builds the app first)                               |
| `pnpm lint`            | ESLint in all packages + `prettier --check`                                 |
| `pnpm typecheck`       | `tsc` / `astro check` in all packages                                       |
| `pnpm format`          | Prettier write                                                              |
| `pnpm bench`           | Canvas perf benchmark (500 nodes / 1,000 edges) → `apps/app/bench/results/` |
| `pnpm schema:generate` | Regenerate types + Zod after editing `packages/schema/schema/v1.json`       |

Single package: `pnpm --filter @sododeck/<name> <script>`.

## Design

- `DESIGN.md` defines tokens and components; `packages/ui` implements them.
- `docs/design/` holds the Claude Design prototype: `claude-design/` (read-only originals, never copy its code), `screens/` (screenshot of every screen and state; match them pixel-close), `design-analysis.md` (inventory, token and schema mapping, gaps vs spec).
- Frames **02–85** are the reference for panel **content** (outline, flows, inspector fields, rules, JSON, library). Frames **86–116** (canvas-first editor) are the reference for editor **placement** (islands, rail, flyouts, drawer, JSON overlay) and the new on-canvas controls. Do not change 02–85 to match the new placement. Frames **117–127** (board B "Deck") are the reference for the **card system** (card frame, states, groups, connectors, playback, fields, tags, palette; DESIGN.md "Card system (Deck)"), built by 029–035.
- Where the prototype and `DESIGN.md` disagree (on-primary text, clay, success green, icons), `DESIGN.md` and `lucide-react` win. Where a frame and a founder decision in `design-analysis.md` §g disagree, the decision wins.
- `docs/backlog.md` lists the Spec Kit features (000–038) with dependencies, acceptance criteria and ready-to-paste `/speckit.specify` prompts; the Database pack (039–049) is in `docs/backlog-database.md`; new features from 066 on (editor hosts) are in `docs/backlog-3.md`.
- Do not name other diagram or database tools anywhere in the repo (docs, specs, code, UI copy); describe features on their own terms.

## Architecture rules

1. **The Yjs document is the single source of truth.** Canvas, JSON panel and inspector are views that read from it and write to it. No duplicated document state: not in Zustand, React state, React Flow state or Monaco models.
2. **`packages/schema` defines the file format; `packages/model` is the only place that converts Yjs ↔ JSON.** Round-trip must be lossless, and that is tested.
3. **Stable ids for every object.** Renames never break references. Never derive ids from titles.
4. **All heavy work (layout, large imports) runs off the main thread** (Web Workers).
5. **No network calls with user diagram content. Ever.** Telemetry is off by default and never carries content. Monaco and fonts are bundled, with no CDNs. An e2e test asserts there are no third-party requests.
6. **Browser-only APIs must be feature-detected** (File System Access, `storage.persist`, BroadcastChannel…) via `apps/app/src/lib/features.ts`.

## Coding conventions

- TypeScript strict everywhere (`noUncheckedIndexedAccess` on). No `any`; no non-null `!`; narrow `unknown` with guards.
- ESLint: typescript-eslint `strictTypeChecked` + react-hooks. Warnings count; keep lint clean.
- Prettier: single quotes, trailing commas, width 100. Don't hand-format.
- Files: kebab-case (`deck-to-flow.ts`), except Astro components (PascalCase). One component per file. Named exports (default only where a tool needs it, e.g. `React.lazy`).
- Internal packages export TypeScript source (no build step). Import via package name (`@sododeck/model`), never relative paths across packages.
- UI: tokens only, with no hard-coded colors (see `packages/ui/CLAUDE.md`). Icons from `lucide-react`.
- State: document data → Yjs via `@sododeck/model`. UI-only state → Zustand. Server state → none (no backend).
- Comments explain _why_, not what. Mark deferred work as `TODO(M<n>): …` or `TODO(schema-v1): …`.
- Dependencies: ask before adding a new runtime dependency. Prefer the platform.
- Commits: Conventional Commits (`feat(app): …`, `fix(model): …`, `chore: …`), small and focused. Enforced by commitlint + husky/lint-staged. Do **not** add `Co-Authored-By:` trailers or any other AI attribution line to commit messages or PR descriptions.

## Testing rules

- **Unit (Vitest):** every pure function and store; every model change gets a round-trip case (`packages/model/test`). Schema changes keep the Ajv/Zod parity test green.
- **Component (Testing Library):** test behavior via roles and labels, not class names or internals.
- **E2E (Playwright, Chromium):** do not add new e2e tests for now (constitution Principle VI, `TODO(e2e)`). The existing smoke suite (`apps/app/tests/e2e/smoke.spec.ts`, incl. the no-third-party-requests check) must keep passing against the production build and stay fast (< 30 s); update it only when a change breaks it.
- Tests live next to code (`*.test.ts`) in apps, and in `test/` in packages.
- A bug fix starts with a failing test.
- Performance-sensitive changes to the canvas: run `pnpm bench` before and after and include the numbers in the report.

## Definition of done

A task is done when all of these hold:

- [ ] Acceptance criteria met and demonstrated (screenshot or test for UI work).
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all pass.
- [ ] New behavior is covered by tests; no skipped or `.only` tests.
- [ ] Architecture rules respected (esp. single source of truth, no network with content).
- [ ] Docs updated: the package `CLAUDE.md` if boundaries or APIs changed, an ADR for any significant decision, README if commands changed.
- [ ] Small conventional commits.
- [ ] Final report: what changed, what was skipped, what is uncertain.

## Milestones

Do not implement a milestone unless asked.

|           | Scope                                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| **M0** ✅ | Monorepo scaffold, tooling, CI, app shell, placeholder site, docs                                          |
| **M1**    | Canvas + Yjs model + read-only JSON panel (synced with canvas) + autosave (IndexedDB) + local deck library |
| **M2**    | Flows: create by clicking edges, highlight + animated token, step player, branches                         |
| **M3**    | Knowledge: inspector, rules (decision tables), stickies, global search                                     |
| **M4**    | Scale: semantic zoom levels, collapsible groups, focus mode, saved views, ELK auto-layout with pinning     |
| **M5**    | Export (JSON/PNG/SVG/PDF/Mermaid), sample decks, onboarding tour, analytics, feedback button               |

## How to work

1. **Restate the scope** in a few lines: what is in and what is explicitly out.
2. **Write acceptance criteria** (testable bullet points). If anything is ambiguous or a decision isn't covered by the spec, DESIGN.md or an ADR, **ask before deciding**.
3. **Implement** in small steps with small commits. Stay inside the package boundaries.
4. **Test**: add tests alongside, then run the full definition-of-done command set.
5. **Report**: what was done, versions/decisions made, what was skipped or uncertain, and a proposal for the next step.
6. **Stop.** Never start the next milestone (or unrequested extras) without being asked.

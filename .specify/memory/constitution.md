<!--
Sync Impact Report
- Version change: (template, unversioned) → 1.0.0
- Principles defined (template placeholders → named principles):
  - [PRINCIPLE_1] → I. Single Source of Truth (Yjs Document)
  - [PRINCIPLE_2] → II. Schema-Owned File Format, Lossless Round-Trip
  - [PRINCIPLE_3] → III. Stable Identity
  - [PRINCIPLE_4] → IV. Local-First and Private by Default
  - [PRINCIPLE_5] → V. Performance Off the Main Thread
  - added → VI. Strict Types and Tested Behavior
  - added → VII. Accessible by Default
  - added → VIII. Simplicity and Justified Dependencies
- Added sections: Technology & Platform Constraints; Development Workflow & Quality Gates
- Removed sections: none
- Dependent templates: .specify/templates/plan-template.md (Constitution Check reads this file at
  runtime), spec-template.md, tasks-template.md — not modified (out of scope for this command);
  no edits required, they reference the constitution generically.
- Follow-up TODOs: TODO(e2e) in Principle VI — new Playwright e2e tests are deferred for now
  (founder decision, 2026-09-27); only the existing smoke suite must pass. Root AGENTS.md (the
  project rules; root CLAUDE.md only imports it) is aligned: no new e2e tests, smoke suite only. Known doc inconsistency outside the constitution: docs/spec.md §6 uses
  `https://sododeck.dev/schema/v1.json`; ADR 0002 and the code use `sododeck.com`.
-->

# Sododeck Constitution

## Core Principles

### I. Single Source of Truth (Yjs Document)

- The Yjs document for a deck MUST be the only store of document data.
- The canvas (React Flow), the JSON code panel (Monaco) and the inspector are views: they MUST read
  from the Yjs document and write to it, and nothing else.
- Document data MUST NOT be duplicated in Zustand, React state, React Flow state or Monaco models.
  Zustand holds UI-only state (selection, panel layout, zoom); anything that would be exported in a
  `.sododeck.json` file is document data.
- Storage (IndexedDB, files, later cloud sync) MUST attach as Yjs providers, so guest, offline and
  signed-in modes share one code path.

**Rationale:** two-way canvas ↔ JSON sync, undo, multi-tab sync and future CRDT collaboration only
stay consistent when there is exactly one authoritative model.

### II. Schema-Owned File Format, Lossless Round-Trip

- `packages/schema` owns the `.sododeck.json` format. The JSON Schema (`schema/v1.json`, draft
  2020-12) is the source; TypeScript types and Zod validators MUST be generated from it and kept
  current (`pnpm schema:generate`), with the Ajv/Zod parity test green.
- `packages/model` MUST be the only code that converts Yjs ↔ JSON. Apps MUST NOT serialize or
  deserialize the document themselves.
- JSON → Yjs → JSON MUST be lossless. Every model change MUST add a round-trip test case in
  `packages/model/test`.
- Breaking format changes MUST bump `version` and the schema URL and ship a migration in
  `packages/model`. Additive optional fields do not bump the version.
- Dependency direction MUST hold: `app → model → schema`, `app → ui`, `site → ui`, all → `config`.

**Rationale:** the file is a public contract read by the app, a future CLI/MCP server and AI
agents (ADR 0002); one converter and a tested round-trip keep it trustworthy.

### III. Stable Identity

- Every object (node, group, edge, view, feature, flow, step, rule, sticky) MUST have a stable
  `id` assigned at creation.
- Ids MUST NOT be derived from titles or other editable fields, and MUST NOT change on rename,
  move, regroup or re-layout.
- All references (edges → nodes, steps → edges, steps → rules, stickies → anchors, views →
  members) MUST be by id. Renaming any object MUST NOT break a reference; tests MUST cover it for
  new reference types.

**Rationale:** flows, views, rules and notes attach to objects; a rename that breaks them destroys
the knowledge layer users rely on.

### IV. Local-First and Private by Default

- The MVP has no backend and no authentication. The app MUST be fully usable without an account.
- Decks MUST persist in the browser (IndexedDB via Yjs) with autosave, and MUST be exportable and
  importable as `.sododeck.json` at all times.
- User diagram content MUST NEVER be sent over the network. Telemetry is off by default and MUST
  NOT carry content. Monaco, fonts and all assets MUST be bundled (no CDNs, no runtime schema
  fetch). The existing smoke e2e test asserting no third-party requests MUST keep passing.
- Browser-only APIs (File System Access, `storage.persist`, BroadcastChannel, …) MUST be
  feature-detected through `apps/app/src/lib/features.ts`, with a working fallback.

**Rationale:** "works without an account, your data stays on your device, no lock-in" is a core
product promise (spec §5, §9); one leaking request breaks it.

### V. Performance Off the Main Thread

- Heavy work (auto-layout, large imports, bulk validation) MUST run in Web Workers.
- The canvas MUST sustain 60 fps pan/zoom at 500 nodes / 1,000 edges. Flow highlight MUST respond
  in < 100 ms; auto-layout of 200 nodes MUST finish in < 2 s; local autosave MUST persist within
  500 ms.
- Performance-sensitive canvas changes MUST run `pnpm bench` before and after and report both
  numbers. A regression below the targets blocks merge unless explicitly accepted.

**Rationale:** large, flow-heavy systems are the reason Sododeck exists (spec P2); a canvas that
stutters at scale fails its core use case.

### VI. Strict Types and Tested Behavior

- TypeScript strict everywhere with `noUncheckedIndexedAccess`. No `any`, no non-null `!`;
  `unknown` MUST be narrowed with guards. ESLint (`strictTypeChecked` + react-hooks) MUST be clean,
  warnings included.
- Every feature MUST ship with unit tests (Vitest) for its pure functions and stores, and
  component tests (Testing Library) for its user-visible behavior.
- Component tests MUST assert behavior via roles and labels, not class names or internals.
- A bug fix MUST start with a failing test. No skipped or `.only` tests may be merged.
- New Playwright e2e tests are NOT required for now. The existing smoke suite
  (`apps/app/tests/e2e/smoke.spec.ts`, incl. the no-third-party-requests check) MUST keep passing
  and stay fast (< 30 s); update it only when a change breaks it.
  TODO(e2e): reintroduce one e2e test per user-facing flow via a constitution amendment.

**Rationale:** one founder plus AI agents maintain the code; strict types and behavior tests are
the safety net that makes fast, agent-written changes safe.

### VII. Accessible by Default

- Every action MUST be reachable and operable by keyboard, with a visible focus indicator.
  Canvas objects, flows and the step player MUST be navigable without a pointer.
- State MUST NEVER be conveyed by color alone: highlighted, dimmed, selected, error-path and
  invalid states MUST also differ by shape, pattern, icon, weight or text.
- Interactive elements MUST have accessible names; the target is WCAG 2.1 AA. UI MUST use design
  tokens only (no hard-coded colors), per `DESIGN.md` and `packages/ui`.

**Rationale:** flow tracing is color- and pointer-heavy by nature; accessibility must be designed
in, not retrofitted (spec §12).

### VIII. Simplicity and Justified Dependencies

- A new dependency MUST NOT be added without a stated reason in the feature's `plan.md` (what it
  solves, why the platform or an existing dependency is insufficient, bundle/size impact). New
  runtime dependencies also require the founder's approval before adding.
- Prefer the platform and existing packages. Build only what the current milestone needs (YAGNI);
  do not implement a milestone or extra that was not requested.
- Significant decisions MUST be recorded as an ADR in `docs/decisions/`.

**Rationale:** a small team cannot afford to maintain, audit and upgrade code it does not need.

## Technology & Platform Constraints

- Monorepo: pnpm + Turborepo; Node ≥ 24 (`.nvmrc`), pnpm pinned via `packageManager`.
- `apps/app`: Vite + React SPA (React Router data mode), static on Cloudflare Pages, offline-capable
  after first load. `apps/site`: Astro static site. See ADR 0001.
- Canvas: React Flow (xyflow). Model: Yjs. Code panel: Monaco with the bundled JSON Schema.
  Layout: ELK.js in a Web Worker. UI: Tailwind v4 tokens, shadcn/ui, Radix, `lucide-react` icons.
- File format: strict JSON `.sododeck.json` with `$schema` and `version` (ADR 0002).
- Internal packages export TypeScript source and are imported by package name, never by relative
  paths across packages.
- Browser support: latest 2 versions of Chrome, Edge, Firefox and Safari. UI language: English.

## Development Workflow & Quality Gates

- Work proceeds by milestone (M0–M5 in `AGENTS.md`); features follow Spec Kit: specify → plan →
  tasks → implement. Each `plan.md` MUST include a Constitution Check against all eight principles
  and justify any deviation in its Complexity Tracking table.
- Each package's `CLAUDE.md` defines its boundaries and MUST be read before changing that package,
  and updated when its boundaries or APIs change.
- Definition of done: acceptance criteria demonstrated (test or screenshot for UI);
  `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all pass (`pnpm e2e` runs
  the existing smoke suite; no new e2e tests required); new behavior covered by unit/component
  tests; docs/ADRs updated.
- Commits MUST be small and follow Conventional Commits (enforced by commitlint + husky).
- Every change report states what changed, what was skipped and what is uncertain.

## Governance

- This constitution supersedes other practices where they conflict. `AGENTS.md` and the package
  `CLAUDE.md` files are the runtime guidance and MUST stay consistent with it; `docs/spec.md` defines product scope.
- Amendments are made via `/speckit-constitution`, in a dedicated commit that updates the Sync
  Impact Report, and, when a principle changes meaning, an ADR explaining why.
- Versioning (semantic): MAJOR for removing or redefining a principle; MINOR for adding a principle
  or section or materially expanding guidance; PATCH for clarifications and wording.
- Compliance: every plan's Constitution Check and every review MUST verify these principles.
  Deviations MUST be justified in writing in `plan.md` and approved by the founder; unjustified
  deviations block merge.

**Version**: 1.0.0 | **Ratified**: 2026-09-27 | **Last Amended**: 2026-09-27

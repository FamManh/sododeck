# Research: Flow Playback "Deck"

Decisions for the open points of [plan.md](plan.md). Each: Decision, Rationale, Alternatives.

## R1. Where card states are computed

**Decision**: New pure `step-marks.ts` in `apps/app/src/editor/flows/`. `stepMarks(path, currentIndex)` walks the played path (`playedPath` result) once and returns `Map<nodeId, { state: 'played' | 'current' | 'upcoming'; number: string | null }>`. Rules (spec Clarifications):

- Current = target of the current step; number = the current step's number.
- Every other node reached as a target of a step before the current one → `played`, no number shown. The source of the current step → `played`. The source of step 1 → `played`.
- A node never reached up to the current step but reached later → `upcoming`, number = the first later step where it is a target.
- A node with several appearances keeps its most advanced state up to the current step (current > played > upcoming).

**Rationale**: One function decides, so tests cover the whole table and components stay dumb. O(steps).

**Alternatives**: Deciding in `deck-node.tsx` from `currentStep` and `inPath` (spreads the rule over components, hard to test); storing marks in the UI store (duplicates derived state, Principle I).

## R2. Edge states

**Decision**: `edgeStateOf(pathIndex, currentIndex)` in the same module → `played | current | upcoming`; `EdgeFlowMark` gains `state`. Existing `inPath` and `current` stay (bench selector, a11y). Error paths keep `errorPath` from `EdgeBadge` and override the stroke.

**Rationale**: Today edges have only "on path" and "current"; played and upcoming need an index comparison against the current step, which `playedPath` already provides.

**Alternatives**: CSS-only `:has()` ordering (cannot know order); per-edge store subscriptions (re-render cost).

## R3. Sticker placement and rendering

**Decision**: A `StepSticker` component rendered inside `DeckNode` (and the collapsed group's front card) at `top:-9; left:-9`, `aria-hidden`, `pointer-events: none`, `data-step-state`. Sizes 22 / 26 / 22 from DESIGN.md; ring 2px Surface; ✓ is a `lucide-react` `Check`. The card box and `cardSize` are unchanged.

**Rationale**: Overlaying inside the node keeps it moving with the card and out of hit tests. The −9 offset puts it on the corner only (spec edge case: never over the header tile).

**Alternatives**: `ViewportPortal` layer (needs per-frame position sync); SVG overlay (loses theme tokens); changing the card padding (violates "no size change").

## R4. Current lip below 60 % zoom

**Decision**: `[data-lipless]` today zeroes `--sd-deck-lip-current`. Keep the other three zeroed and stop zeroing `-current`; move `--sd-deck-lip-current: 5px` from `index.css` into `tokens.css`. Lift stays on `.current-step`.

**Rationale**: FR-006 makes the current step the one exception. One CSS line; no re-render (the wrapper flag is already there).

**Alternatives**: A second wrapper flag for flow mode (extra state); drawing the current lip as a pseudo-element (duplicates the lip system).

## R5. Token

**Decision**: `flow-token.tsx` draws an SVG group: lip circle (r 12, offset 3px, Orange Ink), disc (r 12, Deck Orange, 2.5px Surface ring) and `<text>` with the step number (11.5 / 700, On Primary), `aria-hidden`. Animation stays `animateMotion` on the same path string (curved, elbow, straight and self-loop already work). Reduced motion: existing `tokenLoopMs = 0` branch → static at the label midpoint. The token receives `number` from `EdgeFlowMark.current`.

**Rationale**: Minimal diff: same mount points (`deck-edge`, `merged-edge`), same motion rule.

**Alternatives**: HTML overlay positioned by `getPointAtLength` (needs a rAF loop, costs the 2× bench).

## R6. Connector styles and the error end

**Decision**: `FLOW_STROKES` becomes: `played` Secondary 2.5; `current` Deck Orange 3.25 plus an 8px halo path at 18 % under it; `upcoming` dashed `2 6` round caps; `error` Clay 2.5 dashed `7 4`; existing `candidate` / `preview` / `invalid` unchanged. Error paths end in an × (new `cross` end in the edge-end drawing) and no arrow. The label stays a `Step n` pill, so state is readable without colour (FR-011).

**Rationale**: Matches DESIGN.md "Connector states". `--color-clay-ink` is the available Clay stroke token (no plain `clay`), so Clay = `clay-ink` for strokes and text, `clay-soft` for fills.

**Alternatives**: Keep today's arrow on error paths (spec FR-009 says ×).

## R7. Dimming values

**Decision**: Cards consume `--sd-deck-dim` (0.22) in `[data-flow-mode] .react-flow__node:not(.in-flow)`; connectors use a new `--sd-deck-dim-edge: 0.2`. Both via tokens, with the existing `--sd-dur-dim` transition (zero under reduced motion). `flow-mode-css.test.ts` asserts no literal opacity is left.

**Rationale**: Today `index.css` hard-codes 0.2 for both and ignores the 0.22 token. The spec keeps 22 % cards / 20 % connectors (Assumptions).

**Alternatives**: One shared 0.22 (changes DESIGN.md's edge value without a decision).

## R8. Player and branch picker

**Decision**: Restyle in place, behaviour untouched. Panel radius 16, 1.5px Border-strong, 3px lip, Float shadow, `min(560px, …)` width kept. Play button 40px round with an Orange Ink lip. Segments 8px: played Secondary, current Deck Orange, upcoming Surface 3. `playerView` marks `nextFork` on the segment of the next branch point (strictly after the current step) → dashed outline. Branch picker stays inline in the player (007), items show a number hint (1, 2, …) and an error item gets a dashed Clay border and ⊗; the hint is visual only, **no new number-key shortcut** (behaviour is out of scope).

**Rationale**: Spec says behaviour unchanged. Frame 117 shows a popover next to the decision; moving it is a placement change with focus and keyboard consequences, so it is left out and flagged to the founder as a known deviation (below).

**Alternatives**: Build the popover now (new anchoring, focus and dismiss rules; belongs in its own change).

**Flag**: DESIGN.md says "Branch popover: a panel next to the decision with number keys." This plan keeps 007's inline picker; confirm or open a follow-up.

## R9. Tokens

**Decision**: Add to `tokens.css`: `--sd-deck-lip-current` (moved), `--sd-deck-dim-edge`, sticker sizes as CSS variables (`--sd-step-sticker`, `--sd-step-sticker-current`, `--sd-flow-token`), and map `--color-deck-dim`, `--color-deck-dim-edge` in `theme.css`. Colours reuse existing tokens: Ink, Surface, Text secondary, `deck-orange`, `deck-orange-ink`, `deck-orange-soft`, `clay-ink`, `clay-soft`. `tokens-only.test.ts` keeps guarding literals.

**Rationale**: No hard-coded colours (AGENTS.md); only sizes are new.

## R10. Export

**Decision**: No code change. `scene.ts` calls `flowOverlay(..., null, null)`, so exports carry flow strokes and step badges but no current, played or upcoming marks, token or stickers. FR-021 therefore reduces to a regression test that an export of a deck with an open flow contains no sticker, lip or token elements.

**Rationale**: Resolves the spec's open point; the existing `render-svg` flow stroke / badge stay as they are (ADR 0016).

## R11. Collapsed groups

**Decision**: `collapse-flow-marks.ts` folds member card states into the group with priority current > played > upcoming and a `flowInside` value `'current' | 'played' | 'upcoming'` (replacing `'current' | 'path'`). The front card shows the same `StepSticker`; `FlowInsideDot` and its pulse (`sd-flow-inside-dot`) are removed. The group's `aria-label` keeps ", flow step inside".

**Rationale**: Spec edge case; one visual language; the pulse animation would otherwise need a reduced-motion rule.

## R12. Performance and bench

**Decision**: Run `pnpm bench` before and after; report "next step → current painted" and "playing at 2×". Keep the bench's `CURRENT_LABEL` selector (`[data-testid="edge-label"][aria-current="step"]`) valid: the label keeps `aria-current="step"` on the current step. Marks are computed in the existing overlay pass, once per step change.

**Rationale**: AGENTS.md requires bench numbers for canvas-affecting changes; 029's result (85.7 ms) is the baseline, and the newest raw run (170 ms) shows machine-load noise, so the report must state the machine state and use the median of 5.

## R13. Accessibility

**Decision**: Stickers and token are `aria-hidden`; the card keeps `aria-current="step"` for the current card only; no extra `aria-live`. Contrast tests in `packages/ui/test/contrast.test.ts` for On-primary on Deck Orange, Surface on Ink (✓), Text secondary on Surface (upcoming number), Clay ink on Clay soft (error label), both themes, ≥ 4.5:1.

**Rationale**: FR-019, FR-020. If a pair fails, the token is adjusted in `tokens.css` and recorded in DESIGN.md.

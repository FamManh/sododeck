# Quickstart: validating 053

## Prerequisites

`pnpm install`, Node ≥ 24. Run `pnpm dev` (app on :5173). Reference images are in `reference/`
(local only).

## Automated

```bash
pnpm schema:generate          # after v1.json edits; commit the generated output
pnpm --filter @sododeck/schema test
pnpm --filter @sododeck/model test
pnpm --filter @sododeck/app test
pnpm lint && pnpm typecheck && pnpm build && pnpm e2e
pnpm bench                    # run before starting and after finishing; compare
```

Expected: all green; bench shows no regression beyond noise.

## Manual scenarios (spec → check)

1. **US1**: add a sticky, type "Why two queues?", drag from its handle onto a card → connector appears;
   move the card, the connector follows; ⌘Z removes only the connector; delete the sticky → the
   confirmation lists the connector; reload keeps everything.
2. **US2**: place a sticky beside a card in light and dark: clearly different. Resize by a corner; size
   persists after reload. Type 1 word (large), 6 words (smaller), 60 words (small, none cut); fix size
   to 16 in the toolbar: it stops changing. Open an old deck: stickies show at the default size.
3. **US3**: select a sticky: toolbar shows; pick a colour, tag (picker shared with cards), lock, delete;
   multi-select three stickies and change colour once. Drag a note from the Add flyout pad over a card:
   the note is free, in edit mode.
4. **US4**: shift-click three connectors → toolbar; change colour, weight, arrow end; one ⌘Z reverts
   all; lock them and try to drag a bend (refused).
5. **Edges**: hide stickies → their connectors hide; export PNG/SVG shows resized notes, tags and
   sticky connectors; JSON panel shows the new fields.

## Evidence to attach to the PR

Screenshots (light and dark) of the paper look, toolbar, pad tile, multi-connector toolbar; bench
before/after numbers; lint/typecheck/test/build/e2e results. Do not attach or commit the founder's
third-party reference images.

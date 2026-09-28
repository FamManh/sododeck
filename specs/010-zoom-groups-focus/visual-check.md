# Visual check

Best-effort review completed on 2026-09-27.

## Limitation

I could validate the shipped UI only through headless Playwright and component tests in this environment. I did **not** produce side-by-side screenshots for `docs/design/screens/` frames 13, 19 and 64–71 because there was no interactive display / human visual review loop available in-session.

## What was checked

- Breadcrumb, group label, collapsed card, merged edge pill, focus toggle and level indicator all have dedicated component or canvas tests.
- Light/dark token usage stayed inside `apps/app/` and uses existing `@sododeck/ui` tokens / lucide icons.
- Landscape group styling, collapsed card stacking, focus dimming/ring, and flow-inside ring/dot were verified through the updated node/edge tests and canvas integration tests.

## Differences / known review gaps

- The crumb text uses the allowed constant **"System view"**.
- Icons use **lucide-react**, as required by repo rules.
- I could not visually confirm pixel-close spacing, typography and motion timing against frames 13, 19 and 64–71 without manual screenshot comparison.

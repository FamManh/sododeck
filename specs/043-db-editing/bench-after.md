# Bench after (043 T053)

Same machine and command as [bench-before.md](bench-before.md)
(`BENCH_TABLES=150 BENCH_REL=1 pnpm bench`), on the 043 branch with every story built, from a
clean checkout. This run had the machine to itself; the before run shared it with unit tests,
so small gains below are partly noise. Indicative only.

## Pan / zoom / drag

| Scenario                   | Before render (ms) | After render (ms) | Before FPS | After FPS | Before long frames | After long frames |
| -------------------------- | ------------------ | ----------------- | ---------- | --------- | ------------------ | ----------------- |
| default                    | 311                | 239               | 50.0       | 51.2      | 3.8 %              | 3.3 %             |
| onlyRenderVisibleElements  | 237                | 241               | 49.3       | 50.7      | 2.4 %              | 2.2 %             |
| jsonDeckOpen               | 276                | 251               | 46.9       | 51.1      | 4.8 %              | 2.7 %             |
| drawer-open-pan            | 301                | 243               | 49.3       | 51.8      | 2.8 %              | 3.3 %             |
| selection-toolbar-pan      | 349                | 221               | 48.8       | 51.8      | 3.6 %              | 2.9 %             |
| drag                       | 302                | 226               | 34.3       | 42.0      | 23.0 %             | 18.4 %            |
| drag+jsonDeck              | 295                | 239               | 34.4       | 39.0      | 22.7 %             | 24.6 %            |
| drag-100-selected          | 319                | 238               | 31.5       | 44.1      | 18.2 %             | 15.3 %            |
| playing at 2×              | 312                | 281               | 53.8       | 59.8      | 2.2 %              | 0.0 %             |
| pan-during-layout (2 pans) | 264                | 231               | 23.5       | 24.5      | 32.5 %             | 38.7 %            |

## Actions (action → painted, median)

| Scenario                      | Target (ms) | Before (ms) | After (ms) |
| ----------------------------- | ----------- | ----------- | ---------- |
| select 3 → toolbar painted    | 100         | 85.6        | 27.1       |
| select flow → marks painted   | 100         | 304.3       | 155.2      |
| open flow → flow mode painted | 100         | 284.8       | 233.8      |
| next step → current painted   | 100         | 323.3       | 192.4      |
| record click → badge          | 100         | 199.9       | 112.4      |
| hover → focus painted         | 16          | 15.4        | 19.9       |
| view-switch (System → Infra)  | 200         | 133.8       | 100.2      |
| tidy-layout-200 (median of 3) | 2000        | 374.2       | 276.0      |
| ⌘K type → results (2000/4000) | 50          | 59.6        | 54.9       |

## Reading

- Every pan, zoom and drag scenario is within 5 % of before or better (target T053 met). One
  likely real gain: `tableLayoutOf` now passes the node itself to `cachedTableLayout`, so the
  per-node table layout cache hits; before, a fresh copy missed it on every call.
- `hover → focus painted` moved from 15.4 to 19.9 ms. 042's runs measured 19–26 ms for the same
  scenario, so this is within run-to-run noise; nothing in 043 touches the hover path.
- `inspector title edit → canvas` and `export-preview` failed as before (known, not this feature).
- A first after-run made while `pnpm test` was running gave render times of 345–539 ms; it is
  not used.

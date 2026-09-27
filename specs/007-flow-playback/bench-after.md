# Bench after (007 flow playback)

`pnpm bench` on the feature branch, same machine, headless Chromium, CPU throttle 1×, 500 nodes /
1,000 edges. Headless numbers are indicative; this shared machine varies ±30 ms between runs.

## Frame rate (target 60 fps, SC-002)

| Scenario                  | Before | After | Meets target                         |
| ------------------------- | ------ | ----- | ------------------------------------ |
| default                   | 59.6   | 59.8  | yes                                  |
| onlyRenderVisibleElements | 60.0   | 59.8  | yes                                  |
| jsonDeckOpen              | 59.8   | 59.8  | yes                                  |
| drag                      | 59.5   | 59.5  | yes                                  |
| drag+jsonDeck             | 60.0   | 60.0  | yes                                  |
| playing at 2× (new)       | —      | 59.0  | yes (p95 16.8 ms, 0.3 % long frames) |

## Action → painted (target < 100 ms, SC-001), median of 5

| Scenario                            | Before | After | Meets target |
| ----------------------------------- | ------ | ----- | ------------ |
| select flow → marks painted         | 14.8   | 81.0  | yes          |
| open flow → flow mode painted (new) | —      | 82.3  | yes          |
| next step → current painted (new)   | —      | 45.1  | yes          |
| record click → badge                | 68.1   | 71.0  | yes          |

A 15-run check of "open flow" gave medians of 83.6 and 85.6 ms (max 117 ms); one 5-run bench
pass hit 150 ms on an outlier.

## Notes

- "Select flow" now enters flow mode (007): the whole deck dims, so it does the same work as
  "open flow". Before, it only drew the flow's own marks, hence 14.8 ms.
- The cost of opening a flow is mostly the browser: one style recalc of the dimmed deck
  (~17 ms) and starting 1,500 opacity transitions (~20 ms for the 1,000 edges alone). Fading
  only nodes would bring the median to ~65 ms but breaks the spec's 250 ms fade on connections,
  so it was not done.
- Toggling React Flow's `nodesDraggable` / `nodesConnectable` / `edgesReconnectable` in flow mode
  re-rendered every node and edge (~40 ms). Flow mode keeps them on and is view-only through the
  canvas handlers and CSS instead.
- `scrollIntoView` on the progress segment scrolled ancestors and cost ~25 ms per step; the
  player now scrolls only its own list, and only when it overflows.

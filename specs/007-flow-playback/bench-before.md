# Bench before (007 flow playback)

Baseline on `main` (`bcc8f88`), `pnpm bench`, headless Chromium, CPU throttle 1×, 500 nodes /
1,000 edges.

| Scenario                  | Avg FPS |
| ------------------------- | ------- |
| default                   | 59.6    |
| onlyRenderVisibleElements | 60.0    |
| jsonDeckOpen              | 59.8    |
| drag                      | 59.5    |
| drag+jsonDeck             | 60.0    |

| Flow scenario (006), median of 5 | Action → painted (ms) |
| -------------------------------- | --------------------- |
| select flow → marks painted      | 14.8                  |
| record click → badge             | 68.1                  |

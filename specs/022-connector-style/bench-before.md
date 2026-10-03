# Bench before 022 (main at f34c66a)

Headless Chromium on one machine, 500 nodes / 1,000 edges; indicative only (run-to-run variation is a few fps). Commit `f34c66a` is the code before 022.

## pnpm bench

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 4.00     | 481         | 461                | 52.8    | 16.8           | 150.0          | 2.2%        | no           |
| onlyRenderVisibleElements | 460 / 6 of 500                 | 4.00     | 425         | 406                | 54.0    | 16.8           | 166.6          | 1.9%        | no           |
| selection-toolbar-pan     | 500 / 500 of 500               | 4.00     | 153         | 0                  | 52.0    | 16.8           | 166.7          | 1.9%        | no           |
| drag                      | 500 / 500 of 500               | 0.30     | 424         | 405                | 59.2    | 16.8           | 50.0           | 0.6%        | yes          |
| drag-100-selected         | 500 / 500 of 500               | 0.30     | 422         | 405                | 49.5    | 33.4           | 66.6           | 8.2%        | no           |

## BENCH_LINE_TYPES=1

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 4.00     | 441         | 423                | 52.3    | 16.8           | 150.1          | 2.1%        | no           |
| onlyRenderVisibleElements | 460 / 6 of 500                 | 4.00     | 425         | 405                | 54.5    | 16.8           | 133.3          | 2.1%        | no           |
| selection-toolbar-pan     | 500 / 500 of 500               | 4.00     | 147         | 0                  | 52.7    | 16.7           | 133.4          | 2.2%        | no           |
| drag                      | 500 / 500 of 500               | 0.30     | 423         | 406                | 57.9    | 16.8           | 33.4           | 0.0%        | yes          |
| drag-100-selected         | 500 / 500 of 500               | 0.30     | 423         | 406                | 50.9    | 33.4           | 50.1           | 4.6%        | no           |

## BENCH_ROUTES=1

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 4.00     | 441         | 421                | 53.2    | 16.8           | 150.0          | 1.8%        | no           |
| onlyRenderVisibleElements | 460 / 6 of 500                 | 4.00     | 407         | 389                | 53.6    | 16.8           | 150.1          | 1.9%        | no           |
| selection-toolbar-pan     | 500 / 500 of 500               | 4.00     | 165         | 0                  | 52.8    | 16.8           | 166.7          | 2.1%        | no           |
| drag                      | 500 / 500 of 500               | 0.30     | 423         | 404                | 57.9    | 16.8           | 49.9           | 1.2%        | yes          |
| drag-100-selected         | 500 / 500 of 500               | 0.30     | 424         | 406                | 50.2    | 33.4           | 50.1           | 5.1%        | no           |

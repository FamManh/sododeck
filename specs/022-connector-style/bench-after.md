# Bench after 022

Headless Chromium on one machine, 500 nodes / 1,000 edges; indicative only (run-to-run variation is a few fps). Commit `f34c66a` is the code before 022.

## pnpm bench

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 4.00     | 479         | 460                | 52.4    | 16.8           | 150.1          | 1.8%        | no           |
| onlyRenderVisibleElements | 460 / 6 of 500                 | 4.00     | 407         | 388                | 54.0    | 16.8           | 133.3          | 1.8%        | no           |
| selection-toolbar-pan     | 500 / 500 of 500               | 4.00     | 154         | 0                  | 52.6    | 16.8           | 150.1          | 2.2%        | no           |
| drag                      | 500 / 500 of 500               | 0.30     | 438         | 421                | 59.3    | 16.7           | 33.4           | 0.0%        | yes          |
| drag-100-selected         | 500 / 500 of 500               | 0.30     | 421         | 404                | 47.8    | 50.0           | 66.7           | 10.4%       | no           |

## BENCH_LINE_TYPES=1

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 4.00     | 441         | 422                | 52.5    | 16.8           | 150.0          | 1.8%        | no           |
| onlyRenderVisibleElements | 460 / 6 of 500                 | 4.00     | 425         | 407                | 54.5    | 16.8           | 133.4          | 2.2%        | no           |
| selection-toolbar-pan     | 500 / 500 of 500               | 4.00     | 153         | 0                  | 52.2    | 16.8           | 133.4          | 2.4%        | no           |
| drag                      | 500 / 500 of 500               | 0.30     | 422         | 404                | 58.9    | 16.8           | 33.4           | 0.0%        | yes          |
| drag-100-selected         | 500 / 500 of 500               | 0.30     | 428         | 419                | 49.5    | 33.4           | 66.7           | 6.9%        | no           |

## BENCH_ROUTES=1

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 4.00     | 458         | 438                | 52.4    | 16.8           | 150.1          | 2.5%        | no           |
| onlyRenderVisibleElements | 460 / 6 of 500                 | 4.00     | 438         | 421                | 54.2    | 16.8           | 133.3          | 2.1%        | no           |
| selection-toolbar-pan     | 500 / 500 of 500               | 4.00     | 152         | 0                  | 52.2    | 16.8           | 166.7          | 2.5%        | no           |
| drag                      | 500 / 500 of 500               | 0.30     | 433         | 409                | 58.9    | 16.7           | 50.0           | 0.6%        | yes          |
| drag-100-selected         | 500 / 500 of 500               | 0.30     | 405         | 387                | 49.5    | 33.4           | 66.7           | 7.3%        | no           |

## BENCH_ANIMATED=1 (200 animated, half dashed)

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 4.00     | 444         | 424                | 54.0    | 16.8           | 150.0          | 2.0%        | no           |
| onlyRenderVisibleElements | 460 / 6 of 500                 | 4.00     | 424         | 406                | 53.8    | 16.8           | 150.0          | 2.5%        | no           |
| selection-toolbar-pan     | 500 / 500 of 500               | 4.00     | 147         | 0                  | 54.0    | 16.8           | 149.9          | 2.0%        | no           |
| drag                      | 500 / 500 of 500               | 0.30     | 439         | 421                | 58.9    | 16.8           | 33.4           | 0.0%        | yes          |
| drag-100-selected         | 500 / 500 of 500               | 0.30     | 438         | 421                | 50.7    | 33.4           | 100.1          | 4.9%        | no           |

## BENCH_BENDS=1 (200 connectors with 3 bends)

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 4.00     | 440         | 422                | 52.7    | 16.8           | 166.7          | 2.1%        | no           |
| onlyRenderVisibleElements | 460 / 6 of 500                 | 4.00     | 441         | 423                | 54.1    | 16.8           | 133.4          | 1.9%        | no           |
| selection-toolbar-pan     | 500 / 500 of 500               | 4.00     | 159         | 0                  | 52.6    | 16.8           | 166.7          | 2.4%        | no           |
| drag                      | 500 / 500 of 500               | 0.30     | 563         | 543                | 58.9    | 16.8           | 50.0           | 0.6%        | yes          |
| drag-100-selected         | 500 / 500 of 500               | 0.30     | 461         | 443                | 49.7    | 33.4           | 66.7           | 7.9%        | no           |

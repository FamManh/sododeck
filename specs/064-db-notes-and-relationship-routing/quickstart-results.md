# Quickstart results (064, T045)

Walked on `pnpm dev` (Chromium, 2026-10-07) with the quickstart DBML imported. Screenshots in [screenshots/](screenshots/).

| #   | Result                                                                                                                                       | How checked                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | Pass: note icons after `users`, `id`, `email`; none on `created_at`, `nickname`; no note text under the title                                | Browser                                                                     |
| 2   | Pass: popover right of `email`: `varchar(320)`, Not null, Note "Used for sign-in" (`02-column-popover-email-dark.jpg`, `…-light.jpg`)        | Browser                                                                     |
| 3   | Pass: moving to `id` switches at once (Primary key, note)                                                                                    | Browser; `db-hover.test.ts`                                                 |
| 4   | Pass: `created_at` shows `Default now()`, no Note section                                                                                    | Browser                                                                     |
| 5   | Pass: `nickname` opens nothing                                                                                                               | Browser                                                                     |
| 6   | Pass: `users` title opens the table popover; `audit` title opens nothing (`06-table-popover-users-dark.jpg`)                                 | Browser                                                                     |
| 7   | Pass: "Open details" opens the drawer on the `email` column (`07-open-details-email-dark.jpg`)                                               | Browser                                                                     |
| 8   | Pass (tests): a drag closes the popover, none opens during it                                                                                | `table-body.test.tsx`, `db-hover.test.ts`                                   |
| 9   | Pass (tests): the enum popover closes the column popover, never both                                                                         | `db-popover.test.tsx`, `ui-store.test.ts`                                   |
| 10  | Pass (tests): touch hover opens nothing; a tap on the icon opens it and never reaches the row                                                | `table-body.test.tsx`, `note-icon.test.tsx`                                 |
| 11  | Pass (tests): focus rest on a hidden row opens a keyboard popover; the content is announced                                                  | `table-body.test.tsx`, `db-popover.test.tsx`                                |
| 12  | Pass (tests): "Note icons" off hides the icons; hover still opens                                                                            | `table-layout.test.ts`, `deck-node.test.tsx`, `deck-inspector.test.tsx`     |
| 13  | Pass: the middle segment follows the drag, ends stay on their rows, the path is kept after reload (`13-relationship-*.jpg`). Undo: unit test | Browser; `segment-drag.test.ts`                                             |
| 14  | Pass (tests): bends are stored relative to the table centres and follow table moves                                                          | `deck-edge.relationship.test.tsx`                                           |
| 15  | Pass: Curved is stored and drawn, Straight draws no bends, Elbow shows the stored bends again; crow's feet on every shape                    | Browser; `relationship-inspector.test.tsx`, `relationship-geometry.test.ts` |
| 16  | Pass: Reset route returns the automatic path and disables itself                                                                             | Browser                                                                     |
| 17  | Pass (tests): shape and waypoints round-trip; SVG has no table note text and draws the icons                                                 | `round-trip.test.ts`, `render-svg.test.ts`, `scene.test.ts`                 |

Note: the dev origin had a stale service worker from an earlier production build, which served old code until it was unregistered.

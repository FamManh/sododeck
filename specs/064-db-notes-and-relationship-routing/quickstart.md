# Quickstart: validate 064

## Setup

```bash
cd ../sododeck-064
pnpm install
pnpm bench            # before the change → bench-before.md
pnpm dev              # app on :5173
```

Import this DBML (Database › Import):

```dbml
Table users {
  id int [pk, note: 'Unique user ID']
  email varchar(320) [not null, note: 'Used for sign-in']
  created_at timestamp [default: `now()`]
  nickname varchar

  Note: 'Stores registered users'
}

Table orders {
  id int [pk]
  user_id int [ref: > users.id]
}

Table audit {
  id int [pk]
}
```

## Scenarios

| #   | Do                                                                 | Expect                                                                                                            | Spec                            |
| --- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 1   | Look at `users`                                                    | Note icons after `users`, `id`, `email`; none on `created_at`, `nickname`. No note text under the title.          | US1-2, US2-2/5, FR-005, FR-005a |
| 2   | Rest pointer on `email`                                            | Popover right of the row after ~0.3 s: `email`, `varchar(320)`, Not null, Note "Used for sign-in".                | US1-1, FR-002                   |
| 3   | Move to `id`                                                       | Popover switches at once: Primary key, note.                                                                      | FR-006                          |
| 4   | Hover `created_at`                                                 | Popover with `Default now()`, no Note section.                                                                    | US1-3                           |
| 5   | Hover `nickname`                                                   | No popover.                                                                                                       | US1-4                           |
| 6   | Hover `users` header                                               | Table popover with the note. Hover `audit` header: nothing.                                                       | US2-1/3                         |
| 7   | Click "Open details" in a popover                                  | Drawer opens on the column / table.                                                                               | FR-004                          |
| 8   | Hover `email`, then drag the table                                 | Popover closes; none opens while dragging.                                                                        | FR-007, FR-008                  |
| 9   | With the `email` popover open, hover an enum chip in another table | The column popover closes; only the enum popover shows.                                                           | FR-011                          |
| 10  | Touch emulation: tap the note icon on `email`                      | Popover opens, row not selected.                                                                                  | FR-009a                         |
| 11  | Keyboard: focus a row, ↓ to `email`, wait                          | Popover opens, screen reader announces type and note.                                                             | FR-009                          |
| 12  | Deck settings › Database › Note icons off                          | Icons gone; hover popovers still work.                                                                            | Edge cases                      |
| 13  | Select the `orders → users` relationship, drag its middle          | Line follows; release keeps the path; ends stay on rows. Reload: same path. Undo: old path.                       | US3-1/6                         |
| 14  | Drag a bend; move `orders`                                         | Bend follows; bends move with the tables.                                                                         | US3-2/3                         |
| 15  | Drawer › Line type: Curved, then Straight, then Elbow              | Curved is stored (not a no-op); Straight draws no bends; Elbow shows the bends again. Crow's feet on every shape. | US3-8/9, FR-013b                |
| 16  | Reset route                                                        | Automatic path back.                                                                                              | US3-4                           |
| 17  | Export `.sododeck`, reopen                                         | Shape and bends identical. Export SVG: no table note text, icons drawn.                                           | US3-7, FR-015                   |

## Gates

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
pnpm bench            # after → bench-after.md, compare
```

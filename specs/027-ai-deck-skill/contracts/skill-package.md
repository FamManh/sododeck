# Contract: skill package layout and instructions (027)

## Layout (shipped archive `sododeck-deck.zip`, root folder `sododeck-deck/`)

```
sododeck-deck/
├── SKILL.md                    router: modes → one reference; repair loop; handover
├── VERSION.json
├── references/
│   ├── modeling.md             card types (generated table), levels, groups, ids, positions
│   ├── flows.md                steps, branches, touches, playback
│   ├── rules.md                decision tables, attaching rules to steps and cards
│   ├── database.md             database pack: tables, columns, relationships
│   ├── taste.md                dials, budgets, what to leave out, shape follows meaning
│   ├── from-codebase.md        (phase 2) scanning, source links, fidelity report
│   ├── from-text-formats.md    (phase 2) Mermaid / C4 text / OpenAPI mapping, fidelity report
│   └── scripts.md              every script, options, output, exit codes, problem codes (generated)
├── schema/v1.json
├── examples/
│   ├── checkout.sododeck       services + one flow
│   ├── refund-policy.sododeck  flow with a decision rule on a step
│   └── platform.sododeck       groups and two levels
└── scripts/ sododeck.mjs, validate.mjs, lint.mjs, summary.mjs, diff.mjs, deliver.mjs
```

## SKILL.md frontmatter

```yaml
---
name: sododeck-deck
description: >-
  Writes and edits Sododeck decks (.sododeck files): architecture components, connectors, groups,
  step-by-step flows and decision rules, checked by bundled validate and lint scripts so the file
  imports cleanly. Use whenever the user wants a system, architecture, service or flow diagram,
  wants to document how requests move through services, has a .sododeck file to change, or asks
  for a deck from a description, a codebase, Mermaid, C4 or OpenAPI, even if they don't say
  "Sododeck".
---
```

## SKILL.md body (sections, in order)

1. What a deck is (model, not picture; the app draws it) and the one-paragraph workflow.
2. Pick a mode → read one reference (table: description → modeling.md (+ flows.md / rules.md when
   asked); update → modeling.md + run summary first; codebase → from-codebase.md; text formats →
   from-text-formats.md; database → database.md). Read taste.md once per new deck.
3. Dials (detail, audience) and their defaults.
4. The repair loop: draft to a temporary file → validate → lint → fix → repeat → deliver.
5. Update mode rules (keep ids and positions, change only what was asked, show diff).
6. Handover format: file path, what is in it (summary), assumptions, warnings left and why, diff
   in update mode, fidelity report in codebase / text modes, how to import (drop the file on the
   library or use Import; paste import problems back if any).

Limits: `SKILL.md` < 500 lines (target ~150); references > 300 lines start with a table of contents.

## Handover template (agent output)

```
Deck: <path>  (<n> cards, <n> connectors, <n> flows) — validate ✓ lint ✓ (<n> warnings)
What's in it: <summary lines>
Assumed: <bullets or "nothing">
Warnings kept: <code — why>   (omit when none)
Changes (update mode): <diff text>
Fidelity (codebase / text modes): merged …, collapsed …, left out …, could not map …
Import: open Sododeck → Library → Import (or drop the file). If it reports problems, paste them here.
```

# UI Contract: Playback marks

Observable contract for tests (roles, labels, data attributes). Pixel values are in [DESIGN.md](../../../DESIGN.md) "Flow playback".

## Card

| Element                    | Contract                                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card root (`.sd-card`)     | `aria-current="step"` only on the current card; unchanged `aria-label`; size and position unchanged                                                              |
| Sticker                    | child of the card root, `aria-hidden="true"`, `data-testid="step-sticker"`, `data-step-state="played\|current\|upcoming"`, not focusable, `pointer-events: none` |
| Played sticker             | contains a ✓ icon, no number                                                                                                                                     |
| Current / upcoming sticker | text = the step number                                                                                                                                           |
| Outside flow mode          | no sticker exists                                                                                                                                                |
| Not on played path         | no sticker; opacity from `--sd-deck-dim`                                                                                                                         |

## Collapsed group

Front card carries the same sticker with the folded state (current > played > upcoming); `aria-label` still ends with ", flow step inside" when a path member is inside.

## Connector

| Element                                 | Contract                                                                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Edge label (`data-testid="edge-label"`) | keeps `aria-current="step"` on the current step (bench selector); text carries the step number; `data-step-state` added     |
| Error path                              | dashed stroke, `×` end marker, no arrow, ⊗ icon in the label                                                                |
| Token (`data-testid="flow-token"`)      | `aria-hidden`, shows the current step number; at most one in the document; static (no `animateMotion`) under reduced motion |

## Player

| Element       | Contract                                                                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel         | `section` named "Step player" (unchanged)                                                                                                                              |
| Progress      | `ol` named "Progress"; each segment is a `button` named "Go to step n of N…" (unchanged); `aria-current="step"` on the current; next fork segment has `data-next-fork` |
| Branch picker | `radiogroup` named by "AT STEP n" (unchanged); number hint is `aria-hidden`; error item still announces ", error path"                                                 |

## Announcements

Exactly one polite announcement per step change, text unchanged from 007 (`stepAnnouncement`). Marks add none.

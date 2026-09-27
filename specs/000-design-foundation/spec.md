# Feature Specification: Design Foundation (shared visual building blocks)

**Feature Branch**: `000-design-foundation`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "`docs/backlog.md` first task" → backlog item **000-design-foundation**
(M1, no dependencies, est. 4 d): "Create the shared visual building blocks for Sododeck so every
screen looks like the approved design in both light and dark themes. Users should see consistent
buttons (primary, secondary, ghost, icon, chip, toggle), text fields, inline-editable text,
multi-line text, selects, search fields with a keyboard hint, segmented controls, switches,
removable tag chips with an add field, colored "kind" tiles for the six component kinds, banners
(warning, success, error), modal dialogs, toasts and a step-by-step coach-mark tooltip. Motion must
be short and calm and must respect the user's reduced-motion setting. Every control must be usable
by keyboard with a visible focus indicator and meet WCAG 2.1 AA contrast. Why: feature screens are
built by different agents over many weeks and must stay visually identical to the design and to
each other; accessibility must be built in from the start. Include a hidden gallery page that shows
every building block in every state and theme for visual review."

## User Scenarios & Testing _(mandatory)_

The "users" of this feature are twofold: **end users** of Sododeck, who experience the building
blocks on every screen, and **feature builders** (the founder and AI agents), who assemble later
screens (library, editor, inspector, export, onboarding) from these blocks. The feature ships no new
end-user screen; its value is realised through consistency and accessibility of every later screen.

### User Story 1 - Consistent core controls in both themes (Priority: P1)

A feature builder needs buttons, text fields, inline-editable text, multi-line text, selects, search
fields, segmented controls and switches that already look like the approved design in light and dark
themes, so that a screen built from them matches the design screenshots without per-screen styling.
An end user sees the same control look and behave identically wherever it appears.

**Why this priority**: Every later feature (library, canvas chrome, inspector, JSON panel, export)
depends on these controls. Without them, each feature re-invents controls and visual drift starts
immediately.

**Independent Test**: Open the review gallery in light theme, compare each control with the matching
design screenshots (`02-editor-node-selected`, `14-editor-palette-tab`, `06-export-json`), switch to
dark theme and compare again; delivers value on its own because the next feature (library, canvas)
can already be built from these controls.

**Acceptance Scenarios**:

1. **Given** the gallery in light theme, **When** it is compared side by side with the design
   screenshots, **Then** buttons (primary, secondary, ghost, icon, chip, toggle), text field,
   inline-edit text, multi-line text, select, search field, segmented control and switch match the
   design in size, corner radius, typography and color, except for the documented design-system
   overrides (dark label on the orange accent, clay error color, success green, line icons).
2. **Given** the gallery is shown, **When** the theme is switched to dark, **Then** every control
   re-renders in the dark palette without reload, and no control keeps a light-theme color.
3. **Given** a text field, **When** it receives focus, **Then** its border turns to the accent color
   and the focus state is visibly distinct from the resting state.
4. **Given** an inline-edit text, **When** it is at rest, **Then** it looks like plain text; **When**
   hovered, **Then** a border appears; **When** focused, **Then** the border uses the accent color.
5. **Given** a search field with a keyboard hint (e.g. "⌘K"), **When** it is displayed, **Then** the
   hint is shown at the trailing edge and the field shows a leading search icon.
6. **Given** a segmented control with 2–3 options, **When** the user presses the arrow keys, **Then**
   the selection moves between options and the active option is visually raised.
7. **Given** a toggle button or switch, **When** it is activated, **Then** its on/pressed state is
   shown by both color and a non-color cue (position of the switch thumb, border/weight of the toggle)
   and is announced to assistive technology as pressed/checked.
8. **Given** a disabled control, **When** it is displayed, **Then** it looks disabled, cannot be
   activated by pointer or keyboard, and is announced as disabled.

---

### User Story 2 - Keyboard and assistive-technology access for every control (Priority: P1)

An end user who navigates by keyboard or screen reader can reach and operate every building block,
always sees where focus is, and reads all text with sufficient contrast in both themes.

**Why this priority**: The constitution (Principle VII) requires accessibility by default; retrofitting
it into dozens of later screens is far more expensive than building it into the shared blocks once.

**Independent Test**: Using only the keyboard, tab through the entire gallery in both themes; verify
every interactive element receives a visible focus indicator, can be operated with the expected keys,
and exposes an accessible name and role; run an automated contrast check on the gallery.

**Acceptance Scenarios**:

1. **Given** keyboard-only use, **When** the user tabs through the gallery, **Then** every
   interactive block receives focus in a logical order and shows a visible focus indicator.
2. **Given** focus on a button, switch, toggle or tag remove control, **When** Space or Enter is
   pressed, **Then** it activates as appropriate for its role.
3. **Given** focus on a select or segmented control, **When** arrow keys are pressed, **Then** the
   option changes accordingly.
4. **Given** an open dialog, **When** the user presses Tab repeatedly, **Then** focus stays inside
   the dialog; **When** Esc is pressed, **Then** the dialog closes and focus returns to the element
   that opened it.
5. **Given** any text or icon rendered by a building block, **When** measured in light and dark
   theme, **Then** it meets WCAG 2.1 AA contrast (4.5:1 for normal text, 3:1 for large text, icons
   and focus indicators).
6. **Given** an icon-only button, **When** read by a screen reader, **Then** it announces a
   meaningful accessible name.

---

### User Story 3 - Component-kind tiles and icon vocabulary (Priority: P2)

An end user recognises the six component kinds (client, gateway, service, queue, database, external)
by a consistent colored tile with a matching icon everywhere they appear (canvas nodes, palette,
inspector, search results). Feature builders pick icons from one agreed icon vocabulary that maps
every glyph used in the design to its equivalent in the project's icon set.

**Why this priority**: Kind tiles appear on almost every editor screen and the palette; a shared
mapping prevents each feature from choosing different icons for the same concept. It is needed by
the canvas feature (003) but not by the library screen.

**Independent Test**: Render a tile for each of the six kinds at the four standard sizes in both
themes and compare with the palette screenshot (`14-editor-palette-tab`); check that the icon mapping
table covers every glyph used in the design prototype.

**Acceptance Scenarios**:

1. **Given** a kind name (client, gateway, service, queue, database, external), **When** a kind
   tile is rendered, **Then** it shows that kind's mapped icon with that kind's soft background and
   ink foreground colors.
2. **Given** a kind tile, **When** rendered at 22, 28, 30 or 40 px, **Then** the corner radius and
   icon size scale proportionally (radius ≈ 0.3 × size).
3. **Given** an unknown or missing kind, **When** a tile is requested, **Then** a neutral fallback
   tile is shown rather than an error or an empty space.
4. **Given** the design prototype's list of icon glyphs, **When** the mapping table is checked,
   **Then** every glyph has a mapped icon or a documented substitute.

---

### User Story 4 - Tags, banners, dialogs, toasts and coach marks (Priority: P2)

An end user can add and remove tags on an object, sees warning/success/error banners that can be
dismissed, uses modal dialogs, receives short confirmation toasts that disappear by themselves, and
can follow a step-by-step coach-mark tour — all with the same look on every screen.

**Why this priority**: These are needed by the library (banner), inspector (tags), export (dialog,
switch), custom views (toast) and onboarding (coach mark). They are required before those features
but not before the first canvas work.

**Independent Test**: In the gallery, add and remove tags, dismiss each banner type, open and close
the dialog, trigger a toast and step through a 3-step coach mark; compare with the library,
export-dialog, custom-view-toast and tour screenshots.

**Acceptance Scenarios**:

1. **Given** an empty tag input, **When** the user types "PII" and presses Enter twice, **Then**
   exactly one tag "pii" exists (tags are lower-cased and de-duplicated; empty input adds nothing).
2. **Given** a tag chip, **When** the user activates its remove control (pointer, or keyboard focus
   plus Enter/Space/Backspace/Delete), **Then** the tag is removed and focus moves to a sensible
   neighbour (next chip or the add field).
3. **Given** a banner of type warning, success or error, **When** displayed, **Then** it uses the
   matching color set and an icon, so the type is recognisable without color; **When** its dismiss
   control is activated, **Then** it disappears.
4. **Given** a dialog, **When** opened, **Then** it is centred above a dimming backdrop with the
   modal shadow and radius from the design; **When** the backdrop is clicked or Esc pressed,
   **Then** it closes.
5. **Given** a toast is triggered, **When** 2.6 seconds pass, **Then** it disappears automatically;
   while visible, its message is announced politely to assistive technology.
6. **Given** a 3-step coach mark anchored to an element, **When** shown, **Then** it displays an
   arrow toward the anchor, "n of 3", progress dots and Skip/Back/Next actions; **When** Next is
   activated on the last step, **Then** the tour ends; Back is unavailable on the first step.
7. **Given** a coach mark is open, **When** the user presses Esc, **Then** the tour is skipped and
   focus returns to the page.

---

### User Story 5 - Calm motion that respects reduced-motion (Priority: P2)

An end user sees only short, calm transitions (no bounce, no elaborate easing), and a user who has
asked their operating system to reduce motion sees no looping animation and no transition delays.

**Why this priority**: Flow playback (007), focus mode (010) and toasts rely on shared motion timing;
defining it once keeps timing consistent and makes reduced-motion support automatic.

**Independent Test**: Read the motion values in the gallery with and without the reduced-motion
preference enabled and observe a looping demo animation.

**Acceptance Scenarios**:

1. **Given** the default motion preference, **When** motion values are read, **Then** they are:
   dim 250 ms, selection ring 200 ms, flow token loop 1.4 s, flow step 1.7 s, toast 2.6 s.
2. **Given** the reduced-motion preference is on, **When** motion values are read, **Then**
   transition durations resolve to 0 and looping animations do not run.
3. **Given** the reduced-motion preference is on, **When** a toast is shown, **Then** it still
   stays visible long enough to be read (its display time is not reduced to 0) but appears without
   animation.

---

### User Story 6 - Hidden review gallery (Priority: P3)

A feature builder or reviewer opens a hidden gallery page, available only in development builds,
that shows every building block in every variant and state, in light and dark themes, for visual
comparison with the design screenshots.

**Why this priority**: It is the review surface for this feature and for future visual regressions,
but no end user ever sees it.

**Independent Test**: Start the app in development mode, open the gallery address, and confirm every
block and state listed in this spec is present; build for production and confirm the gallery is not
reachable.

**Acceptance Scenarios**:

1. **Given** a development build, **When** the gallery address is opened, **Then** every building
   block in this spec is shown in each variant and state (rest, hover sample, focus sample, active,
   disabled, error where applicable), with a control to switch light/dark.
2. **Given** a production build, **When** the gallery address is opened, **Then** it is not
   available (falls through to the normal not-found behavior) and its code is not shipped.

---

### Edge Cases

- A tag input receives only whitespace, or a tag with surrounding spaces or mixed case → whitespace
  is trimmed, empty input adds nothing, case is normalised to lower case, duplicates are ignored.
- A very long tag, banner message, select option or dialog title → text wraps or truncates with the
  full text available (e.g. via tooltip or accessible name); layout never breaks.
- Multiple toasts triggered in quick succession → they are shown in order without overlapping
  unreadably; each is still announced.
- A coach mark anchor is off-screen or missing → the coach mark is still shown in a visible position
  (or the step is skipped) rather than rendering out of view.
- A dialog is opened from within another overlay (e.g. a select) → only one modal layer traps focus;
  Esc closes the topmost layer first.
- The theme is switched while a dialog, toast or coach mark is open → it re-renders in the new
  theme without closing.
- The reduced-motion preference changes while the app is open → the new setting takes effect
  without reload.
- A kind name with unexpected case (e.g. "Database") → treated the same as its lower-case form.
- Browser zoom at 200% → controls remain usable and text does not overlap.

## Requirements _(mandatory)_

### Functional Requirements

**Visual foundation**

- **FR-001**: The design system MUST provide named motion values: dim 250 ms, selection ring 200 ms,
  flow token loop 1.4 s (linear, infinite), flow step 1.7 s, toast 2.6 s, with no bounce or
  overshoot easing.
- **FR-002**: Under the user's reduced-motion preference, transition durations MUST resolve to 0 and
  looping animations MUST be disabled; display times that exist for readability (toast) MUST NOT be
  shortened to 0.
- **FR-003**: The design system MUST provide the additional elevation styles used in the design
  (hover lift, coach-mark/tour) and the additional corner radii (segment 7 px, row 8 px, banner
  14 px), available in both themes.
- **FR-004**: All building blocks MUST take colors only from the design-system tokens; no block may
  contain a fixed color value, and switching theme MUST restyle every block without per-block
  theme overrides. This MUST be verifiable by an automated check.
- **FR-005**: Where the design prototype and `DESIGN.md` disagree (text on the orange accent, clay
  error color, success green, icon set), `DESIGN.md` values MUST be used.

**Icons**

- **FR-006**: The project MUST provide a documented mapping from every icon glyph used in the design
  prototype (~70) to an icon from the project's line-icon set, with a documented substitute where no
  direct equivalent exists.
- **FR-007**: The project MUST provide a typed lookup from each of the six component kinds (client,
  gateway, service, queue, database, external) to its icon and its soft/ink color pair.

**Controls**

- **FR-008**: Button MUST offer variants primary, secondary, ghost, icon (28–34 px), chip (24–26 px
  pill) and toggle (with a pressed state using the accent-soft fill and accent border), each with
  hover, focus, disabled states.
- **FR-009**: Text input MUST be 36 px tall with a 10 px radius; on focus its border MUST switch to
  the accent color.
- **FR-010**: Inline-edit text MUST appear borderless at rest, show a border on hover and an accent
  border on focus.
- **FR-011**: Multi-line text MUST use the monospaced style from the design (12.5 px / 1.55 line
  height) and be vertically resizable.
- **FR-012**: Select MUST present a 36 px trigger and a list of options operable by pointer and
  keyboard.
- **FR-013**: Search field MUST show a leading search icon, a borderless recessed surface, and an
  optional trailing keyboard-shortcut hint.
- **FR-014**: Segmented control MUST support 2–3 options, show the active option raised on the
  track, and support arrow-key navigation.
- **FR-015**: Switch MUST be 32×18 px, with the "off" state on a neutral track and "on" on the
  accent, and expose its checked state to assistive technology.
- **FR-016**: Tag chip MUST show its label and a remove control; tag input MUST show a dashed
  "+ tag" add field that, on Enter, adds the trimmed, lower-cased value unless empty or already
  present.
- **FR-017**: Kind tile MUST render any of the six kinds at 22, 28, 30 and 40 px, with radius
  ≈ 0.3 × size, the kind's icon and colors, and a neutral fallback for unknown kinds.

**Feedback and overlays**

- **FR-018**: Banner MUST offer warning (amber), success, and error (clay) types, each with an icon,
  a message, optional action, and a dismiss control.
- **FR-019**: Dialog MUST be modal, centred over a dimming backdrop, with the modal radius (20 px)
  and shadow; it MUST trap focus, close on Esc and backdrop click, and return focus to its trigger.
- **FR-020**: Toast MUST appear as an inverse-colored pill, dismiss itself after 2.6 s, allow an
  optional action (e.g. "Undo"), and be announced politely to assistive technology.
- **FR-021**: Coach mark MUST be a 300 px inverse card with an arrow toward its anchor, a step
  counter ("n of N"), progress dots, and Skip/Back/Next actions; it MUST be keyboard operable and
  closable with Esc.

**Accessibility**

- **FR-022**: Every interactive building block MUST be reachable by keyboard, show a visible focus
  indicator with at least 3:1 contrast against its surroundings, and have an accessible name and
  role.
- **FR-023**: All text and meaningful icons in every building block MUST meet WCAG 2.1 AA contrast
  in both themes.
- **FR-024**: No state (pressed, checked, selected, error, warning, success) may be conveyed by color
  alone; each MUST also differ by shape, position, icon, weight or text.

**Review gallery**

- **FR-025**: A gallery page MUST exist only in development builds and show every building block in
  every variant and state, with a light/dark switch and a reduced-motion demonstration.
- **FR-026**: The gallery MUST NOT be reachable or shipped in production builds.

**Quality**

- **FR-027**: Every building block MUST have automated behavior tests that locate it by role or
  label (not by styling), covering its keyboard interaction and state changes.
- **FR-028**: Building blocks MUST be purely presentational: they hold no document data and make no
  network requests.

### Key Entities

- **Design token**: a named visual value (color, radius, shadow, motion duration) with a light and a
  dark value; the only source of visual values for building blocks.
- **Component kind**: one of six categories of architecture component (client, gateway, service,
  queue, database, external), each with an icon and a soft/ink color pair.
- **Icon mapping entry**: a glyph name from the design prototype, its equivalent in the project's
  icon set, and an optional note when it is a substitute.
- **Building block**: a reusable control or overlay (button, input, dialog, …) with defined
  variants, states and keyboard behavior.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of the building blocks listed in FR-008 to FR-021, with all their variants, are shown in
  the review gallery in both themes.
- **SC-002**: In a side-by-side review against the referenced design screenshots, every building
  block matches in size, radius, typography and color within 1–2 px, with the only differences being
  the documented `DESIGN.md` overrides and icon substitutions.
- **SC-003**: An automated check finds 0 fixed color values in building blocks.
- **SC-004**: An automated contrast test over every foreground/background token pair used by the
  building blocks reports 0 WCAG 2.1 AA failures in light and dark, apart from exceptions explicitly
  approved by the founder and recorded in the plan; a manual accessibility audit of the gallery
  reports no further issues.
- **SC-005**: A keyboard-only reviewer can reach and operate 100% of interactive blocks in the
  gallery, with a visible focus indicator on each, without using a pointer.
- **SC-006**: With reduced motion enabled, 0 looping animations run and all transitions complete
  instantly.
- **SC-007**: 100% of icon glyphs used in the design prototype appear in the icon mapping table.
- **SC-008**: Feature builders for the next features (canvas, library) can build their screens
  without creating any new generic control (verified in those features' reviews: no duplicate
  button/input/dialog implementations).

## Assumptions

- Scope follows backlog item 000: design-system building blocks plus a development-only gallery.
  Out of scope: app screens, canvas node/edge visuals (they live with the canvas feature 003),
  command palette behavior (009), changes to `DESIGN.md` colors, stat tiles, link rows, storage
  meter and deck cards (app-level).
- Toast and coach mark are built from the platform and already-approved primitives; no new runtime
  dependency is added without founder approval (constitution VIII). The command palette component is
  not part of this feature.
- The existing Button, Panel and Tooltip blocks are kept and extended (chip and toggle variants)
  rather than replaced.
- The design's "focus = orange border, no glow" style for text inputs is kept; it is judged
  sufficient as a visible focus indicator provided it meets the 3:1 contrast requirement (FR-022).
  If it does not, a focus ring is added and recorded as an allowed difference.
- Icons come from the project's existing line-icon set, drawn at a stroke weight that visually
  matches the prototype; brand glyphs that have no equivalent (e.g. cloud-provider logos) get a
  generic substitute documented in the mapping table.
- The design uses a static cut of the Geist typeface while the project bundles the variable cut;
  minor rendering differences are accepted.
- Theme preference and reduced-motion follow the user's system setting by default; the gallery's
  theme switch is a review aid, not a product feature.
- Visual review is done by screenshots at 1440×900 in light and dark next to the matching
  `docs/design/screens/*.png`; no new end-to-end tests are added (constitution VI, TODO(e2e)), and
  the existing smoke suite must keep passing.

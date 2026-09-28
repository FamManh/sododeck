# Feature Specification: Export

**Feature Branch**: `012-export`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "012 (export) from docs/backlog.md. Let users export a deck as a re-importable deck file, a PNG image, an SVG vector, a print-ready PDF, or a Mermaid diagram for markdown and wikis. They can export the whole deck, the current view, or the selected flow; see a live preview; choose options per format (pretty JSON, include descriptions and rules, image scale, transparent background, flow step details, groups as subgraphs); copy text formats; and download with a file name based on the deck name. Everything is generated on the user's device and nothing is uploaded. Why: users must never be locked in and need diagrams in their docs, slides and repositories."

**Sources**: `docs/backlog.md` §012 (scope, acceptance criteria, risks) and "Remaining order" (§g-47: 012 runs after the canvas-first work 018–020), `docs/spec.md` I-1 and principle 6 (no lock-in), `docs/design/design-analysis.md` overlays table (frames 06, 33, 34), the "Export" behaviour notes and the dialog row of the component inventory, §g-33 (one deck file at a time), `DESIGN.md`, constitution v1.0.0 (principles I, II, IV, V, VII, VIII).

**Dependency note**: 007 (flow playback, flow mode) and 011 (saved views) are merged; 018 (canvas-first shell) is merged and already has three Export entry points (tools island "Export" button, deck ≡ menu "Export…", ⌘K "Export") which today download the `.sododeck.json` directly (005). This feature puts the export dialog behind those three entry points. Card size and connector routes (017) and card colours (020) are drawn in image exports when the deck has them; if 017 or 020 is not merged yet, the export shows what the canvas shows at that time. No file-format change.

## Scope

**In scope**

- An **export dialog** ("Export deck") opened from the tools-island Export button, the deck menu "Export…" and ⌘K "Export". It has a format list, a scope switch, a live preview, options for each format and a footer with the file name, a size hint, Copy and Download (frames 06, 33 PNG / SVG, 34).
- **Three formats**: JSON (`.sododeck.json`, can be imported again), PNG and SVG.
- **Three scopes for images**: Whole deck, Current view, Selected flow (only available in flow mode, and chosen by default there). JSON always contains the whole deck.
- **Options for each format**: JSON "Include descriptions, links and rules" and "Pretty-print"; PNG scale 1× / 2× / 3× and "Transparent background"; SVG "Transparent background".
- **Copy** for the text formats (JSON, SVG). **Download** for every format, with a file name taken from the deck name.
- Everything is generated on the user's device. Large decks are generated without freezing the editor.
- Keyboard and screen-reader access, light and dark themes for the dialog, reduced motion.

**Out of scope**

- **PDF and Mermaid export** (frames 33-pdf and 33-mermaid): deferred by the founder (Clarifications). They are not shown in the format list. The format list is built so they can be added later without a new dialog.
- A partial JSON (only the current view or one flow): JSON is always the whole deck (Clarifications).
- Importing Mermaid, draw.io or YAML (I-2, P1); embeds and share links (P2).
- Several decks, folders or all decks in one file (§g-33).
- Exporting only the current selection of components (a "Selection" scope).
- Changing the direct one-click backup exports that stay as they are: the library deck menu "Export .sododeck.json" (005), the deck inspector storage "Export .sododeck.json" and the autosave error "Export" button (005). They still download the whole deck as JSON with no dialog, because they are a backup path.
- Remembering export options across sessions (see Assumptions).

## Clarifications

### Session 2026-09-28

- Q: What does a JSON export of "Current view" or "Selected flow" contain? → A: Always the whole deck; the scope switch is disabled while JSON is selected (option B, recommended: lossless, no schema change, no rules for cutting a deck apart).
- Q: How is the PDF produced? → A: Not in this feature. Only JSON and image formats (PNG, SVG) are supported for now; PDF and Mermaid are deferred.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Download the deck as a file that can be imported again (Priority: P1)

An architect wants to keep a copy of "Logistics Delivery" in their git repository. They click Export in the tools island. The "Export deck" dialog opens with JSON selected and a preview of the file. The footer shows `logistics-delivery.sododeck.json · 11.9 KB`. They click Download. Later a colleague imports that file and gets the same deck.

**Why this priority**: an open, re-importable file is the core promise against lock-in (principle 6); the image formats build on the same dialog.

**Independent Test**: open the dialog on a sample deck, download JSON with default options, import the file as a new deck and compare it with the original; nothing may differ except the deck's own id if import assigns a new one.

**Acceptance Scenarios**:

1. **Given** an open deck, **When** the user clicks Export in the tools island, chooses "Export…" in the deck menu, or runs "Export" from ⌘K, **Then** the "Export deck" dialog opens with its subtitle "Exports are generated in your browser. Nothing is uploaded."
2. **Given** the dialog opens outside flow mode, **When** it shows, **Then** JSON is selected, both JSON options are on, and the preview shows the start of the file.
3. **Given** JSON is selected, **When** the dialog shows the scope switch, **Then** it shows "Whole deck" and is disabled, with the note "JSON always contains the whole deck".
4. **Given** JSON with default options, **When** the user clicks Download and imports the downloaded file, **Then** the imported deck has the same components, connections, groups, flows, rules, stickies, views and positions as the original (lossless round-trip).
5. **Given** the deck "Logistics Delivery", **When** the dialog shows JSON, **Then** the footer shows the file name `logistics-delivery.sododeck.json` and the file size (e.g. "11.9 KB").
6. **Given** JSON, **When** the user turns "Pretty-print" off, **Then** the preview and the file become compact (no indentation), and the size in the footer shrinks.
7. **Given** JSON, **When** the user turns "Include descriptions, links and rules" off, **Then** the file has no descriptions, no links, no rules and no rule references, and it can still be imported.
8. **Given** JSON, **When** the user clicks Copy, **Then** the same text as the download is on the clipboard and a toast confirms "Copied".

---

### User Story 2 - Put a picture of the diagram in a doc or slide (Priority: P1)

A product lead needs the system diagram in a slide. In the dialog they choose PNG. The preview shows the diagram. They pick 3×; the footer now says "3270 × 1980 px". They turn on "Transparent background" and click Download. The PNG shows the cards, connections, groups and labels as on the canvas, sharp at slide size. For a design tool they choose SVG instead and get the same picture as editable vector.

**Why this priority**: images for docs and slides are the most common export after the file itself.

**Independent Test**: export PNG at 1×, 2× and 3× and check each image size against the footer; export with and without a transparent background; export SVG and open it in a browser and a vector tool; compare both with the canvas.

**Acceptance Scenarios**:

1. **Given** PNG, **When** the user picks 1×, 2× or 3×, **Then** the footer shows the image size in pixels before download, and the downloaded image has exactly that size, which is the diagram's bounds plus margin times the scale.
2. **Given** PNG, **When** the dialog first shows PNG, **Then** 2× is selected and "Transparent background" is off.
3. **Given** "Transparent background" on, **When** exported, **Then** the area outside cards, group frames and stickies is transparent; **When** off, **Then** it is the light canvas background.
4. **Given** PNG or SVG, **When** exported, **Then** cards show their kind icon, title and subtitle, connections show their labels and arrows, groups show their frame and label, and the text uses the app's own fonts (not a fallback font).
5. **Given** SVG, **When** the user downloads it and opens it in a vector design tool or a browser, **Then** it shows the same picture as the PNG, and texts are real text (can be selected and edited).
6. **Given** SVG, **When** the user clicks Copy, **Then** the SVG markup is on the clipboard; **Given** PNG, **Then** there is no Copy button.
7. **Given** the app in dark theme, **When** an image is exported, **Then** the image uses the light appearance (see Assumptions).

---

### User Story 3 - Export a picture of just one flow (Priority: P1)

The architect is in flow mode on "Place order". They open Export: PNG is selected and the scope is already "Selected flow". The preview shows only the components and connections used by "Place order", with the step numbers. They download it for the ticket that describes this feature.

**Why this priority**: flows are Sododeck's core idea; a picture of one flow is what goes into feature tickets and reviews.

**Independent Test**: enter flow mode on a flow, open the dialog, confirm the format and scope, export PNG and SVG and check that only the flow's components and connections appear.

**Acceptance Scenarios**:

1. **Given** flow mode on "Place order", **When** the dialog opens, **Then** PNG is selected and the scope is "Selected flow".
2. **Given** scope "Selected flow" and PNG or SVG, **When** exported, **Then** the image contains only the flow's components and connections (and the frames of the groups that contain them), and shows the step numbers on the flow's connections as the canvas does in flow mode.
3. **Given** the editor is not in flow mode, **When** an image format is selected, **Then** "Selected flow" is shown but disabled, with a tooltip "Open a flow to export it".
4. **Given** scope "Selected flow", **When** the footer shows the file name, **Then** it includes the flow name, e.g. `logistics-delivery-place-order.png`.
5. **Given** flow mode with "Selected flow" chosen, **When** the user switches to JSON and back to PNG, **Then** JSON shows the disabled "Whole deck" scope and PNG shows "Selected flow" again.

---

### User Story 4 - Export a picture of the current view (Priority: P2)

The architect is on the "Infra" view, which shows only infrastructure components. They choose PNG and scope "Current view"; the preview shows only what that view shows, and the export matches it.

**Why this priority**: views (011) let people make diagrams for one audience; exporting them is the natural next step, but whole deck and flow cover the first needs.

**Independent Test**: switch to a saved view that hides some components, export PNG with "Current view", and compare it with the canvas.

**Acceptance Scenarios**:

1. **Given** a saved view that hides some kinds or groups, **When** the scope is "Current view", **Then** the preview and the image contain exactly the components, connections, groups and stickies that view shows, at their positions in that view.
2. **Given** the user has drilled into a group (010), **When** the scope is "Current view", **Then** the image contains what is visible at that drill level.
3. **Given** the current view and the whole deck show the same content, **When** the user switches between the two scopes, **Then** the preview does not change.
4. **Given** "Current view", **When** exported, **Then** the whole extent of the view is exported, not only the part that fits in the window.

---

### User Story 5 - Do it all from the keyboard (Priority: P2)

A keyboard user presses ⌘K, types "exp", presses Enter. The dialog opens with focus on the selected format. Arrow keys move through the formats; Tab moves to the scope switch, the options, then Copy and Download. Esc closes the dialog and returns focus to where it was.

**Why this priority**: constitution VII requires every action to be keyboard operable.

**Independent Test**: complete an export of each format using only the keyboard and a screen reader, and check names and announcements.

**Acceptance Scenarios**:

1. **Given** the dialog opens, **When** it shows, **Then** focus is on the selected format, and focus stays inside the dialog until it closes.
2. **Given** the format list, **When** the user presses ↑ / ↓, **Then** the selection moves between formats and the right side updates; the list is announced as a group of choices with the selected one marked.
3. **Given** the scope switch with an image format, **When** the user presses ← / →, **Then** the scope changes and the disabled "Selected flow" is skipped.
4. **Given** Copy or Download, **When** done, **Then** a screen-reader announcement and a toast confirm it ("Copied", "Downloaded logistics-delivery.png").
5. **Given** the dialog, **When** the user presses Esc or clicks the scrim or ×, **Then** it closes and focus returns to the control that opened it (or the canvas when opened from ⌘K).

---

### Edge Cases

- **Empty deck** (no components): the preview shows "Nothing to export yet" for PNG and SVG and Download / Copy are disabled for them; JSON can still be exported.
- **Selected flow with no steps**: treated like an empty scope for images.
- **Current view that shows nothing** (all hidden by its filters): same as an empty deck for images.
- **Very large decks** (500 components / 1,000 connections): the dialog opens at once, the preview shows a "Preparing…" state, the editor stays responsive, and the export finishes in the time in SC-003.
- **PNG too big for the browser** (bounds × scale over the browser's image size limit): the scales that are too big are disabled with the tooltip "Too large for this browser", and the largest possible scale is picked.
- **Deck name that is empty, only symbols or non-Latin** (e.g. "注文フロー"): the file name keeps letters and digits of any script, replaces spaces and other characters with "-", and falls back to `untitled-deck` when nothing is left.
- **Clipboard not available or denied**: Copy shows an error toast "Couldn't copy — use Download instead" and nothing else changes.
- **The deck changes while the dialog is open** (another tab edits it, 005 live sync): the preview and the footer update to the new content.
- **The flow shown in flow mode is deleted from another tab while the dialog is open**: the scope switches to "Whole deck" and a note says why.
- **Collapsed groups on the canvas**: images of "Current view" draw them collapsed as the canvas does; images of "Whole deck" draw every group expanded (see Assumptions).
- **Stickies**: drawn in images when sticky notes are shown on the canvas (009); always kept in JSON.
- **JSON with "Include descriptions, links and rules" off**: the flows' rule references are removed too, so the file stays valid and imports without errors.
- **Special characters in titles and labels** (`<`, `&`, quotes): escaped in SVG so the file stays valid and shows the original characters.

## Requirements _(mandatory)_

### Functional Requirements

**Opening and layout**

- **FR-001**: The tools-island Export button, the deck menu "Export…" and the ⌘K command "Export" MUST open the "Export deck" dialog instead of downloading the JSON directly.
- **FR-002**: The dialog MUST match frames 06, 33-png, 33-svg and 34 (without the PDF and Mermaid entries): a title "Export deck", the subtitle "Exports are generated in your browser. Nothing is uploaded.", a close button, a format list on the left, the scope switch, preview and options on the right, and a footer with the file name, a size hint, Copy (text formats only) and Download.
- **FR-003**: The format list MUST show JSON ".sododeck.json · re-importable", PNG "Raster image for docs and slides" and SVG "Vector, editable in Figma", with exactly one selected.
- **FR-004**: When the dialog opens outside flow mode, JSON MUST be selected and the image scope MUST be "Whole deck". In flow mode, PNG MUST be selected and the image scope MUST be "Selected flow".
- **FR-005**: The dialog MUST work in light and dark theme, MUST be modal, and MUST close with Esc, the × button or a click on the scrim, returning focus to where it came from.

**Scope**

- **FR-006**: For PNG and SVG, the scope switch MUST offer Whole deck, Current view and Selected flow; Selected flow MUST be disabled with the tooltip "Open a flow to export it" outside flow mode.
- **FR-007**: For JSON, the scope switch MUST show "Whole deck", be disabled, and show the note "JSON always contains the whole deck". The image scope chosen before MUST come back when the user returns to an image format.
- **FR-008**: "Whole deck" MUST include the top level of the deck with every group expanded and no view filter: every top-level component, connection, group and sticky. Components nested inside another component appear as their parent card with its child count, as on the canvas.
- **FR-009**: "Current view" MUST include exactly what the active view shows at the current drill level (011 filters, 010 drill-in), over its whole extent, not only the visible window.
- **FR-010**: "Selected flow" MUST include only the components and connections used by the steps of the flow shown in flow mode, plus the frames of the groups that contain them.

**Preview and footer**

- **FR-011**: The preview MUST show the export that Download would produce: the start of the text (scrollable) for JSON, and a picture of the result for PNG and SVG.
- **FR-012**: The preview and the footer MUST update each time the format, scope or an option changes, and each time the deck changes while the dialog is open.
- **FR-013**: The footer MUST show the file name and a size hint: JSON and SVG the file size (e.g. "11.9 KB"); PNG the image size in pixels ("2180 × 1320 px").
- **FR-014**: The file name MUST be the deck name made safe for files (lower case, letters and digits of any script kept, other characters replaced with "-", repeated "-" merged, fallback `untitled-deck`), plus "-<flow name>" for the Selected flow scope, plus the format's extension: `.sododeck.json`, `.png`, `.svg`.

**Output and actions**

- **FR-015**: Download MUST save the file with the file name in the footer, then show a toast "Downloaded <file name>" and keep the dialog open.
- **FR-016**: Copy MUST be shown for JSON and SVG only; it MUST put exactly the downloadable text on the clipboard and show a toast "Copied".
- **FR-017**: No export, preview or copy MUST make any network request; all fonts and images used in the output MUST come from the app's bundled files.
- **FR-018**: Generating a large deck (at least the size in SC-003) MUST NOT freeze the editor; while an export is being prepared the preview MUST show "Preparing…" and Download and Copy MUST be disabled.

**JSON**

- **FR-019**: JSON MUST offer "Include descriptions, links and rules" and "Pretty-print", both on by default.
- **FR-020**: JSON with both options on MUST import back into the same deck (lossless round-trip, principle II).
- **FR-021**: With "Pretty-print" off, the JSON MUST be written without indentation and with the same content.
- **FR-022**: With "Include descriptions, links and rules" off, the JSON MUST leave out descriptions, links, rules and every reference to rules, and MUST still be a valid deck file.
- **FR-023**: Every JSON export MUST be a valid `.sododeck.json` file of the whole deck that the app's import accepts.

**Images (PNG, SVG)**

- **FR-024**: Images MUST draw cards (kind icon, title, subtitle, and size, colours and routes where the deck has them), connections (path, arrow, label), group frames and labels, and stickies when they are shown on the canvas, as the canvas draws them.
- **FR-025**: Images MUST use the light appearance with the app's own fonts, and MUST add a fixed margin around the diagram's bounds.
- **FR-026**: PNG MUST offer scales 1×, 2× and 3× (2× by default); the image size MUST be (bounds + margin) × scale, as shown in the footer beforehand. Scales over the browser's image size limit MUST be disabled with the tooltip "Too large for this browser".
- **FR-027**: PNG and SVG MUST offer "Transparent background" (off by default); when on, everything outside cards, group frames and stickies MUST be transparent.
- **FR-028**: SVG text MUST stay text (selectable and editable). The SVG MUST carry the app's fonts so browsers show it like the canvas without the fonts installed; vector tools that ignore embedded fonts MAY substitute a similar font, but the text MUST stay editable.
- **FR-029**: In the "Selected flow" scope, images MUST show the step numbers on the flow's connections as flow mode does.

**Keyboard and accessibility**

- **FR-030**: Focus MUST start on the selected format and stay inside the dialog; ↑ / ↓ MUST move through formats, ← / → through scopes (skipping disabled ones), and every option, Copy and Download MUST be reachable by Tab.
- **FR-031**: The format list and the scope switch MUST be announced as single-choice groups with the selected item; options MUST be announced as switches with their state; the image preview MUST have a text alternative ("Preview of <file name>").
- **FR-032**: Copy, Download, errors and "Preparing…" MUST be announced to screen readers; nothing may depend on colour alone.
- **FR-033**: With reduced motion on, the dialog MUST open and close without animation.

**Errors**

- **FR-034**: If Copy fails, a toast MUST say "Couldn't copy — use Download instead". If generation fails, the preview MUST say "Couldn't create this export" with a Retry button, and the other formats MUST keep working.

### Key Entities

- **Export request**: the chosen format, image scope and the options for that format. It lives only while the dialog is open; nothing is saved in the deck.
- **Scope content**: the set of components, connections, groups and stickies that an image scope includes (FR-008–FR-010), with their positions. It is read from the deck and never changes it.
- **Export result**: the generated text or image, its file name and its size hint, shown in the preview and footer and given to Download / Copy.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: For every sample deck, a JSON export with default options imports back into a deck that is identical to the original (100% of objects and fields).
- **SC-002**: A user can go from an open deck to a downloaded PNG of the whole deck in 3 actions or fewer (open dialog, choose PNG, Download) and in under 10 seconds.
- **SC-003**: For a deck of 500 components and 1,000 connections, the dialog opens in under 300 ms, each preview is ready in under 2 s, a 2× PNG is downloaded in under 5 s, and no main-thread task longer than 50 ms runs while a preview is prepared (except the final PNG draw).
- **SC-004**: The downloaded PNG's pixel size equals the size shown in the footer in 100% of tested scale and scope combinations.
- **SC-005**: Zero network requests are made while opening the dialog, previewing, copying or downloading any format (the smoke test's "no third-party requests" check stays green).
- **SC-006**: Every format can be exported with the keyboard alone, and the dialog has no automated accessibility violations in light and dark theme.

## Assumptions

- **PDF and Mermaid later**: the backlog's PDF and Mermaid acceptance criteria and the "PDF without a dependency" risk move to a later feature; the backlog entry should be updated to match.
- **Image appearance**: images always use the light appearance (with or without background), whatever the app theme, because they mostly go into white docs and slides. A dark-image option is not part of this feature.
- **Collapsed groups**: "Whole deck" images draw every group expanded (collapsing is a way of looking at the canvas, not content); "Current view" draws what the canvas shows, including collapsed groups.
- **Stickies**: in images only when sticky notes are shown on the canvas; always in JSON (they are deck content).
- **Semantic zoom (010)**: images draw cards as the canvas shows them at 100 % zoom (kind icon, title, subtitle), not the zoomed-out level the canvas may show at export time; drilled into a component, the component level applies as on the canvas. Connection labels are always drawn, whatever the Labels toggle. Stickies are drawn in their one-line form.
- **Flow mode opens on PNG**: frame 34 shows JSON with "Selected flow"; since JSON is always the whole deck, the dialog opens on PNG in flow mode so the flow scope applies straight away.
- **Options are not remembered**: each time the dialog opens, the defaults of FR-004, FR-019, FR-026 and FR-027 apply. The last used format is not remembered either. This keeps the feature simple and can be added later.
- **Margin**: a fixed margin (e.g. 32 px at 1×) is added around the diagram's bounds in images; the exact value is set in the plan to match the design.
- **File names**: the dialog uses the lower-case, hyphenated name from the design (`logistics-delivery.sododeck.json`, FR-014). The direct backup exports keep today's naming (the deck name as typed, e.g. `Logistics Delivery.sododeck.json`); aligning them is not part of this feature.
- **Backup exports stay direct**: the library deck menu, the deck inspector storage section and the autosave error button keep downloading the whole deck as JSON without the dialog (005), because they are the backup path.
- **Read-only**: export never changes the deck, adds nothing to undo history and records nothing in the deck file. Library metadata "last export" (005) is updated only by JSON downloads, as today.
- **View-only editor** (window < 1024 px, 018): the export dialog is still available, because it does not edit the deck.
- **No new e2e tests** (constitution VI): the existing smoke suite, including "no third-party requests", must stay green; behaviour is covered by unit and component tests.
- **No new runtime dependency** (principle VIII): JSON, PNG and SVG can be produced with the platform.

# 0031. Groups are connector ends

- **Status:** Accepted
- **Date:** 2026-10-04
- **Feature:** `specs/050-connector-editing` (spec US4, research R4 and R6, data-model, contracts)
- **Builds on:** 0004 (schema v1 shape), 0011 (visible graph), 0017 (group frames), 0020 (file
  format compatibility), 0024 (connector route model)

## Context

The founder connects cards to groups and groups to groups often ("the web app calls the data
layer", "the edge talks to the platform"). Until now a connector's `from` / `to` named a node only,
so the workaround was to pick a member card and pretend, which lies about intent and breaks when
that card moves out of the group.

## Decision

1. **The file format widens, the shape does not.** `Edge.from` / `Edge.to` name a **node or a
   group**. Both were already `Id`; only the descriptions and the semantic-rule wording change.
   Model checks (`refsOf` target `'nodes|groups'`, `validate`, `checkIntegrity`) accept either
   collection, and `endpointOf(deck, id)` / `endpointTitle` replace node-only title lookups.
2. **No version bump.** Every existing file stays valid with the same meaning: an end that named a
   node still names that node. Generated ids are already unique across the deck. A load / integrity
   check flags a node and a group that share an id (`duplicate-id`), because such an end would be
   ambiguous; load refuses a file only when a connector end actually names such an id.
3. **Older builds.** An app build from before this change shows a group-ended connector as a broken
   reference (a problem, not a crash). That is acceptable for a single-deploy app before 1.0, where
   every open tab updates on reload.
4. **Cascade.** Deleting a group, or ungrouping it, deletes every connector whose end is that group,
   in the same transaction and undo step. `previewRemoval` lists them, so the delete confirmation
   counts them ("Also removes 3 connections"). Copy / paste keeps a group-ended connector when both
   ends are in the fragment, remapped through the group id map.
5. **The `'contains'` rule.** On create and reconnect the canvas refuses a connector between a group
   and anything inside it, at any depth (member cards, nested groups, their cards), in either
   direction: "Can't connect a group to something inside it". It is an editor rule, not a file rule:
   a file that already has one draws it and reports no problem. Self and duplicate (either
   direction) apply to groups as to cards.
6. **Drawing.** A group end is drawn on whatever stands for the group in the visible graph: its
   frame (`group:<id>`, four hidden side handles), the collapsed card hiding it, its nearest drawn
   ancestor, or an Outside proxy when it is out of the drill scope. `route` reads against the frame
   box exactly as against a card. Dropping a connector inside a frame (not on a card) or near its
   edge attaches to the group; a card always wins over the group it sits in.
7. **Flow continuity stays plain id equality.** A group-ended connector is an ordinary flow step.
   A step into group G followed by a step leaving a card inside G is a **chain break**, not a
   continuation. That keeps flows predictable and analysable without knowing the group tree; it is
   a known limit.

## Alternatives considered

- **Edge to a chosen member card plus a flag:** keeps the old shape but lies about intent and breaks
  when that card moves out of the group.
- **A separate `groupEdges` collection:** duplicates every connector feature (style, route, label,
  flows, inspector, export).
- **A schema version bump:** nothing old changes meaning, so a bump would only force a migration
  with nothing to migrate.
- **Flow continuity through membership** (into G, out of a member of G continues): needs the group
  tree in every flow check and makes a chain's meaning depend on later regrouping.

## Consequences

- Every place that labels, boxes or positions a connector end resolves groups too: canvas mapping,
  bundles, focus sets, Outside proxies, inspector pickers, connect list, command palette, flows,
  export scene and Tidy layout (ELK edges to the group compound; a connector between a group and
  its own member is left out of the layout request).
- Views: a feature view that uses a group-ended connector keeps the cards inside that group, so
  the frame can be drawn.
- There is no text-diagram export yet; when one is added it must write group ends too.

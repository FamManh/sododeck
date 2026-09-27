# Data Model: Semantic Zoom, Collapsible Groups and Focus Mode (010)

**No document or file-format change.** 010 only reads existing schema v1 fields and adds UI state and derived view models.

## 1. Document fields read (schema v1, unchanged)

| Field                                                  | Used for                                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `node.group`                                           | Group membership: scope members, representatives, counts                     |
| `node.parent`                                          | Level hierarchy: a node is shown only inside its parent's scope (FR-004)     |
| `node.level`                                           | Shown level (inspector row, indicator tooltip); derived from depth if absent |
| `node.tech`, `owner`, `tags`, `rules`                  | Per-level rendering (FR-003)                                                 |
| `group.parent`                                         | Nested groups: scope subtree, outer collapse hides inner groups              |
| `edge.from`, `edge.to`, `edge.direction`, `edge.label` | Merging, direction icon, popover rows                                        |

Integrity rules, applied during derivation and never written back:

- A `parent` or `group` pointing at a missing object is ignored.
- A `parent` cycle (node or group) is broken by treating every member of the cycle as having no parent. This matches `outline.ts` for groups.

## 2. UI state (`state/ui-store.ts`, Zustand, per tab, never persisted)

```ts
type Level = 'landscape' | 'system' | 'container' | 'component'; // = schema Level

interface DrillFrame {
  kind: 'group' | 'node';
  id: string;               // deck id of the group or node
  viewport: CanvasViewport; // viewport before entering, restored on the way up
}

interface Selection {
  nodes: readonly string[];
  edges: readonly string[];
  groups: readonly string[];   // NEW: group label / collapsed card selection
}

// New UiState fields
drill: readonly DrillFrame[];        // [] = whole deck
collapsed: ReadonlySet<string>;      // group ids
focusMode: boolean;

// Popover union gains
| { kind: 'merged'; edgeId: string } // merged edge id "merged:<a>|<b>"
```

New actions:

| Action                                         | Effect                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| `drillInto(frame)`                             | push; clears selection and focus mode                                 |
| `drillUp(depth = length - 1)`                  | pop to `depth`; returns the popped frames (caller restores viewport)  |
| `setCollapsed(id, on)` / `toggleCollapsed(id)` | update `collapsed`                                                    |
| `expandAll(ids)`                               | remove ids from `collapsed` (merged-edge row Enter expands both ends) |
| `setFocusMode(on)`                             | toggle focus mode; `false` when entering flow session / flow mode     |
| `pruneView(existing)`                          | drop `collapsed` ids and `drill` frames whose objects no longer exist |

State transitions:

```
Drill:     []  ──drillInto(g)──▶ [g] ──drillInto(n)──▶ [g, n]
           ▲                        │                     │
           └──── drillUp(0) ────────┘◀──── drillUp(1) ────┘   (crumb, Esc, Backspace, port pill)
           removal of g/n in doc ─▶ pruneView ─▶ pop to deepest valid frame + announce

Collapse:  expanded ⇄ collapsed   (chevron, Space, inspector switch, "Expand group", merged row Enter)

Focus:     off ─F / toggle (selection of 1)─▶ on(id) ─select other─▶ on(id')
           on ─F / toggle / clear selection / enter flow mode or session─▶ off
```

`resetForDeck()` also resets `drill = []`, `collapsed = ∅` and `focusMode = false`.

## 3. Derived view models (pure, never stored, never in the JSON panel)

Defined in [contracts/visible-graph.md](contracts/visible-graph.md):

- **`VisibleGraph`**: the scope, the effective level, and the visible nodes, groups, cards, edges, merged edges and ports.
- **`CollapsedCard`**: `{ groupId, title, nodeCount, edgeCount, rect }`.
- **`MergedEdge`**: `{ id, a, b, edgeIds, count, direction: 'a-to-b' | 'b-to-a' | 'both' }`.
- **`PortPill`**: `{ id, insideNodeId, outsideNodeId, outsideTitle, edgeIds, side }`.
- **`FocusSet`**: `{ focusId, members: Set<string>, edges: Set<string> }`.
- **`CollapsedFlowMarks`**: badges per merged edge, `flowInside` per card.

React Flow ids (prefixes, never clash with deck ids):

| Prefix       | Object               |
| ------------ | -------------------- |
| `group:`     | group boundary (003) |
| `collapsed:` | collapsed group card |
| `merged:`    | merged edge          |
| `port:`      | port pill            |

## 4. Validation rules (from the spec)

- Merged count equals the number of underlying edges; the sum of the counts on the visible edges plus the hidden internal edges equals all deck edges with both ends in scope (SC-004).
- A node appears at most once: as itself, inside a card, or not at all (outside scope / hidden child).
- The effective level is `component` whenever the drill stack contains a node frame (FR-002).
- A group frame can sit on top of a node frame (drill into a system, then into a group of its containers); a node frame can sit on top of a group frame.
- The document snapshot is identical before and after any UI action in this feature (SC-005); tests assert `serializeDeck` equality.

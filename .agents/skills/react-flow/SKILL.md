---
name: react-flow
description: Use when changing the Sododeck canvas in apps/app/src/editor — React Flow (@xyflow/react) nodes, edges, handles, drag, selection, keyboard, viewport, fitView, or any feature that draws deck objects on the canvas (stickies, flow highlight, semantic zoom, groups, drill-in, auto-layout, export preview), or when reviewing such code.
---

# React Flow in Sododeck

React Flow is a **view**. The Yjs deck is the only document state (AGENTS.md rule 1, ADR 0006). Every canvas change follows one loop:

```
deck snapshot + UI store ──derive (pure, cached)──▶ nodes/edges props ──▶ <ReactFlow>
        ▲                                                                    │ gesture
        └──── editor.add/update/remove (useEditor) ◀── handler ◀─────────────┘
              UI-only state (selection, modes) ─▶ useUiStore
```

Read ADR 0006 and `apps/app/CLAUDE.md` before a non-trivial change. This skill is the map and the recipes.

## Map (`apps/app/src`)

| Need                       | Where                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `<ReactFlow>` props, types | `editor/canvas.tsx` (`nodeTypes`/`edgeTypes` at module scope)                                          |
| Visible scope / collapse   | `editor/visible-graph.ts` — `scopeOf`, `visibleGraph`, merged edges, collapsed cards, port pills, scope bounds |
| Current view (011)         | `editor/views/view-state.ts` — `viewStateOf` / `useViewState()` / `readViewState(doc)`: `deck` (view-projected: view positions, hidden components left out, so every geometry helper just works), `collapsed`, `render` (`ViewRender`: subtitle field, flow counts, dimmed, pinned, revealed) → `CanvasView.render` in `deck-to-flow.ts`; `editor/view-filter.ts` decides hidden / dimmed |
| Zoom levels / focus / flow folding | `editor/levels.ts`, `editor/focus-set.ts`, `editor/collapse-flow-marks.ts` |
| Deck → RF objects          | `editor/deck-to-flow.ts` — per-object caches, `GROUP_NODE_PREFIX`, `COLLAPSED_NODE_PREFIX`, `PORT_NODE_PREFIX`, `MERGED_EDGE_PREFIX`, `toFlowNodes`/`toFlowEdges` |
| Export images (012)        | `editor/export/scene.ts` builds a static scene from the same pure helpers (`visibleGraph`, `viewStateOf`, `groupBounds`, `flowOverlay`, `collapseFlowMarks`) plus the cache-free `exportPortRects` / `groupCounts` from `deck-to-flow.ts` and `DOT_RADIUS` from `edge-constants.ts`; never `toFlowNodes` / `toFlowEdges` (single-slot caches). Keep card / edge geometry changes in step with `export/render-svg.ts` and `export/edge-geometry.ts` |
| Connection focus (034)     | `editor/bundles.ts` (`bundleEdges`: parallel automatic connectors → `bundle:` edges, fan-out via `routedPath`'s `spread`), `editor/hover-focus/` (`useHoverFocus` timers, `HoverFocusStyle`: one generated `<style>` keyed on `[data-id]`, no React Flow object changes), `editor/proxy-layout.ts` + `outside-proxy-node.tsx` (drill-in Outside proxies, `port:`), `scope-label-node.tsx` (`scope-label:`); highlight colour / weight are the `--sd-edge-hl-stroke` / `--sd-edge-hl-width` variables `DeckEdge` and `MergedEdge` read |
| Flow marks (006)           | `editor/flows/flow-overlay.ts` — `flowOverlay()` → `EdgeFlowMark` (`data.flow`: badges, style) and node `data.flowStart`; drawn in `deck-edge.tsx` / `deck-node.tsx` |
| Playback marks (007)       | `flowOverlay(…, playback)` (`PlaybackMarks`: played step ids, current step, speed) → `inPath` / `current` on edges, `inPath` / `currentStep` on nodes; `deck-to-flow.ts` turns `inPath` into `className: 'in-flow'`; `[data-flow-mode]` on the canvas wrapper dims the rest (`index.css`); `editor/flow-token.tsx` on the current edge; `flows/use-flow-viewport.ts` fits the flow / follows the step |
| Problem glyphs (015)       | `editor/problems/problem-marks.ts` — `problemMarks(useProblems())` → `CanvasView.problems` → `data.problems` on nodes/edges (in the cache check via `sameProblemMark`); drawn in `deck-node.tsx` (top-right, yields to the connect "+") and on the `deck-edge.tsx` label pill |
| Sizes, positions, bounds   | `editor/canvas-geometry.ts` — `NODE_SIZE`, `displayPosition`, `groupBounds`, `freeSpot`                |
| RF events → writes         | `editor/use-canvas-handlers.ts` (marquee, connect, reconnect, drop); drags of components and group frames go through `editor/editing/drag-session.ts` (`DragController`: snapping, drop into groups, ⌥ copies, Esc), resizes through `editing/frame-resize.ts` (`NodeResizeControl` in `group-boundary-node.tsx`) |
| Shared actions             | `editor/canvas-actions.ts` — `addComponent`, `connectComponents`, `centredOn`                         |
| Keys                       | `editor/use-canvas-shortcuts.ts` (canvas keys + document-wide undo/redo/Delete/Esc)                   |
| Delete                     | `ui.requestDelete(selection)` or `ui.requestRemoval(targets)` → `confirm-delete-dialog.tsx` (`previewRemoval`, one batch, Undo toast) |
| Read / write the deck      | `model/use-deck-snapshot.ts` (`useDeckSnapshot`, `readDeck` in handlers), `model/use-editor.ts`; canvas geometry reads `readViewState(doc).deck` instead; drags → `editor.moveInView`, note drags → `moveStickyInView` |
| UI state                   | `state/ui-store.ts` (Zustand; never document data: drill, focus, current view and level/menu state live here; collapse is per-view document data since 011: `useCollapsed`, `setGroupCollapsed`) |
| Layout                     | `layout/` — ELK in a worker (`createLayoutClient().layout(...)`, `cancel()`); `editor/tidy-layout.ts` builds the request from the visible graph and applies the result in one `moveInView` batch |
| Canvas CSS, tokens         | `index.css` (canvas rules), `@sododeck/ui` `tokens.css` (`--sd-dur-*`); SMIL `dur` needs ms from `resolveMotion`, not CSS vars |
| Motion / reduced motion    | `@sododeck/ui/lib/motion` (`resolveMotion`), `@sododeck/ui/hooks/use-reduced-motion`                  |
| Test harness               | `test/render-canvas.tsx` (`editorWrapper`, `deckOf`) — providers incl. `ReactFlowProvider`            |

## Recipes

**New node or edge type** (sticky, collapsed group, merged edge, leader line)
1. Component in its own file, `memo(function X(props: NodeProps<XFlowNode>))`; register in the module-scope map in `canvas.tsx`.
2. Derive it in `deck-to-flow.ts` with its own cache and **an id prefix** (like `group:` / `collapsed:` / `port:` / `merged:`) so ids never clash with deck ids.
3. Size: fixed-size shapes set explicit `width`/`height` from `canvas-geometry.ts`; a card whose height follows its text sets `width` only and lets RF measure the height.
4. Teach `use-canvas-handlers.ts` the prefix: skip or route it in `onNodeClick`, `onNodeDragStart`, `onNodesChange`, marquee. `Selection` in the UI store holds nodes/edges only; a new selectable kind extends it (and `pruneSelection`).
5. Inputs inside a node: `className="nodrag nowheel"`. Keep a draft in local state while typing and commit once on blur, like `field-edit.tsx`; `isTextTarget` already keeps canvas keys and ⌘Z out of text fields.
6. Adding a double-click handler: set `zoomOnDoubleClick={false}` (RF zooms on double-click by default).

**Positions that follow something** (anchored sticky, members of a group): compute the absolute position while deriving. Do not use RF `parentId`/`extent` — group frames are stored on the group (ADR 0017) and resolved only by `groupBounds`; a group drag (`editing/drag-session.ts`) writes the members and nested frames every frame, so followers move in the same render. When the follower itself is dragged, convert back to what the document stores (e.g. an offset from its anchor) before writing.

**New gesture or command**: handler reads with `readDeck(editor.doc)`, writes with `editor.*`. Several writes → `editor.batch` (one undo step). A multi-frame gesture → `editor.beginGesture()` / `endGesture()`. Keys go in `use-canvas-shortcuts.ts` (they fire only while focus is in the canvas); "at the pointer" = a ref updated on `pointermove` + `screenToFlowPosition`. Deletes always go through `requestDelete`.

**Async results** (ELK worker, imports): re-read the deck when the result arrives and skip objects deleted meanwhile, then write in one `batch`. jsdom has no `Worker`: feature-detect via `lib/features.ts`.

**New visual mode** (flow dimming, focus mode, highlight): mode lives in the UI store. Mark only the few members and dim the rest with one attribute on the canvas wrapper + CSS (`[data-flow-mode] .react-flow__edge:not(.in-flow)`); a flag on all 1,500 objects breaks the < 100 ms target. Watch for:
- Edge labels render in `EdgeLabelRenderer`'s HTML layer, outside `.react-flow__edge`: give them their own class for the CSS.
- `DeckEdge` sets `stroke` inline, which beats CSS: member colours go through `data`. Flow marks already do: `data.flow.style` (`path`, `error`, `candidate`, `preview`, `invalid`) picks stroke, width and dash in `FLOW_STROKES`.
- The overlay is part of the edge/node cache check (`sameMark`), so equal marks keep the cached RF object; a new visual input must be added there too.
- Label pills that carry a flow mark are `pointer-events-none`, so a click on the label reaches the edge (recording).
- `.in-flow` comes from the RF object's `className`. Group boundaries are `.react-flow__node` too, so they dim as well.
- Caches in `deck-to-flow.ts` are keyed by the snapshot object, so edits to the object's own fields invalidate them. Any input from outside the object (selection, focus, mode, other nodes) must be in the cache check, or cached objects never update.
- Focus mode also needs interaction/accessibility state: non-members get `dimmed` data plus `domAttributes` (`aria-hidden`, `inert` for nodes) from `deck-to-flow.ts`; do not try to bolt that on in the rendered node component.

**Zoom-dependent rendering**: one selector in `Canvas` that returns a discrete value (e.g. `useStore(levelSelector)` where the module-scope `levelSelector = (s: ReactFlowState) => levelForZoom(s.transform[2])`), passed down through `data`. Never read the raw zoom inside each node. Rebuilding every object when the level changes is fine (rare); per-frame is not. If a level changes a node's size, keep the box centred on the stored position and convert drags back before writing.

**Per-node custom colour** (020): resolve the document's `style` to a `CardLook` (`card-style.ts`'s `resolveLook`, applying any live `stylePreview` first) outside the node component, then set it as a CSS custom property on the node's root element — `style={{ '--card-fill': look?.fill, '--card-stroke': look?.stroke }}` — and consume it with Tailwind's arbitrary-property classes (`bg-(--card-fill)`, `border-(--card-stroke)`), omitting the key entirely (not `undefined`) when there is no colour so the class falls back to its default token. Do this per node, not with a document-wide CSS rule, since each card can have a different colour; `MiniMap`'s `nodeColor`/`nodeStrokeColor` need the same resolved `look` passed through `data` (RF calls them per node, not per CSS class).

**Animation along an edge** (flow token, `editor/flow-token.tsx`): render it inside the custom edge with `<animateMotion path={path}>`, so it follows re-routing; static at the label point under reduced motion. Put it in its own child component rendered only on the current edge, so hooks like `useReducedMotion` do not run in all 1,000 edges.

**View-only modes** (flow mode): refuse edits in the handlers and hide handles / edge updaters with CSS (`visibility: hidden`; `display: none` zeroes the measured handle bounds and edges jump to the origin). Do not toggle `nodesDraggable` / `nodesConnectable` / `edgesReconnectable` for a mode entered often: every node and edge re-renders (~40 ms at 500 / 1,000).

**Viewport after a document change**: the new nodes reach RF only after the next render. Use `fitBounds(rectYouComputed)`, or `fitView` in `requestAnimationFrame`; animation duration 0 under reduced motion. Never call `fitView` on every render.

## React Flow APIs

| Use freely                                                                                      | Never (they own document state)                                                                      |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `Handle`, `Position`, `BaseEdge`, `EdgeLabelRenderer`, `get*Path`, `NodeProps`/`EdgeProps`       | `useNodesState`, `useEdgesState`, `applyNodeChanges`, `addEdge`                                      |
| `screenToFlowPosition`, `fitView`, `fitBounds`, `setCenter`, `getViewport`, `useStore` selectors | `setNodes`, `setEdges`, `addNodes`, `addEdges`, `updateNode(Data)`, `deleteElements`, `toObject`     |
| `onlyRenderVisibleElements`, `useUpdateNodeInternals` after adding/removing handles              | RF delete key / keyboard a11y (off: `deleteKeyCode={null}`, `disableKeyboardA11y`), `parentId` groups |

Also never: an undo stack outside `Y.UndoManager`, ids from `Date.now()` (the editor makes ids), saving via `localStorage`/`fetch`.

## Review checklist

- [ ] Nothing document-shaped in React state, Zustand or RF state; writes only via `useEditor()`.
- [ ] New types memoized, typed, registered at module scope; synthetic ids prefixed and handled in the handlers.
- [ ] Derivation cached per source object; an edit to one object returns the same RF objects for the others (add a `deck-to-flow.test.ts` case).
- [ ] Multi-write actions are one `batch` / gesture = one ⌘Z (test it).
- [ ] Keyboard path exists and is in `use-canvas-shortcuts.ts`; state is not colour-only; reduced motion respected.
- [ ] `pnpm bench` before/after, numbers in the report (AGENTS.md).

# Contract: Connection focus, bundles and outside proxies (034)

Internal contract between the pure helpers, the canvas, export and tests. Types are in [data-model.md](../data-model.md).

## Pure functions

```ts
// editor/focus-set.ts
focusSet(deck: SododeckFile, graph: VisibleGraph, id: string, bundles?: BundleResult): FocusSet | null;

// editor/bundles.ts
export const BUNDLE_EDGE_PREFIX = 'bundle:';
bundleEdges(
  deck: SododeckFile,
  graph: VisibleGraph,
  options: { exclude: ReadonlySet<string>; fanned: ReadonlySet<string>; off: boolean },
): BundleResult; // same object for equal inputs (cached per graph + options key)

// editor/proxy-layout.ts
proxyLayout(deck: SododeckFile, graph: VisibleGraph, level: Level): readonly OutsideProxy[];

// editor/routing/route-path.ts (existing, one optional field)
routedPath(shape, from, to, sides, offset, arrows, spread?: number): RoutedPath;
```

All four are pure and deterministic; `spread` undefined or 0 returns exactly today's path (regression test).

## Canvas DOM / CSS contract

| Hook                              | Where                                  | Meaning                                                                  |
| --------------------------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| `data-hover-focus` on the wrapper | set by `HoverFocusStyle` via ref       | A hover / keyboard focus is showing.                                     |
| `data-focus-mode` on the wrapper  | existing                               | Pinned focus (F).                                                        |
| `data-id` on nodes and edges      | React Flow                             | Target of the generated selectors.                                       |
| `data-edge-label-for="<id>"`      | `DeckEdge` label, `MergedEdge` pill    | Labels live outside `.react-flow__edge`.                                 |
| `--sd-edge-hl-stroke`             | set on highlighted `.react-flow__edge` | Connector colour when highlighted (Ink). 022 may skip it per connector.  |
| `--sd-edge-hl-width`              | set on highlighted `.react-flow__edge` | Connector width when highlighted (2.75px).                               |
| `.sd-card` neighbour rule         | `index.css`                            | Border and lip in Secondary for focus members other than the focus card. |

Dimmed opacity: cards `var(--sd-deck-dim)`, connectors and labels `var(--color-deck-dim-edge)`; transition `var(--sd-dur-dim)`. Hover focus never sets `inert` or `aria-hidden`; pinned focus keeps doing so (unchanged).

## React Flow objects

| Kind        | id                      | type          | Notes                                                                   |
| ----------- | ----------------------- | ------------- | ----------------------------------------------------------------------- |
| Bundle      | `bundle:a\|b`           | `merged`      | `data.kind: 'bundle'`, `count`, `direction`, `edgeIds`, `fanned`.       |
| Fanned edge | deck edge id            | `deck`        | `data.fan: { index, count }`; otherwise identical to a plain edge.      |
| Proxy       | `port:<nodeId>`         | `port`        | Component `OutsideProxyNode`; not draggable / selectable / connectable. |
| Scope label | `scope-label:<frameId>` | `scope-label` | Not draggable / selectable / focusable.                                 |

Cache rule: each derived object keeps its cached RF object while its inputs are equal (add a `deck-to-flow.test.ts` case per kind). Hover changes no RF object.

## Interaction

| Input                          | Effect                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| Pointer rests 150 ms on a card | Hover focus on it (unless suspended, research R3).                                                  |
| Pointer moves card → card      | Focus switches at once.                                                                             |
| Pointer leaves                 | Clears after 100 ms unless another card is entered.                                                 |
| Keyboard focus on a card       | Hover focus at once (`source: 'keyboard'`); clears when focus leaves.                               |
| Click "×n" pill                | Toggle fan-out.                                                                                     |
| ⏎ on a focused bundle          | Open the bundle popover (same as a merged connector today); focus moves into it.                    |
| Click bundle curve             | Open the bundle popover: Fan out / Fold, then each connector with label, direction, Select, Delete. |
| Esc / click empty canvas       | Fold every fanned bundle (Esc first closes an open popover, as today).                              |
| Click proxy                    | Focus it.                                                                                           |
| Double-click / ⏎ on proxy      | Leave the drill-in to the real card's level; select it, focus it, centre it.                        |

## Accessible names

- Bundle pill: `button`, `aria-label="<n> connections between <A> and <B>"`, `aria-expanded`.
- Proxy: `button`, `aria-label="<title>, outside, press Enter to go to it"`.
- Scope label: decorative (`aria-hidden`); the breadcrumb names the level.

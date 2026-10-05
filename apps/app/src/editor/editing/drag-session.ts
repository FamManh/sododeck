/**
 * One pointer drag of components or of a group frame (016 research R5–R8): what moves, where it
 * started, and what each frame of the drag does with it.
 *
 * - The whole drag is one editor gesture (one undo step). Every frame moves everything by the
 *   anchor's delta: the selected components, and for a group its frame, nested frames and every
 *   member (hidden ones too).
 * - ⇧ locks the axis, ⌘ / Ctrl turns snapping off, arrows add 1 / 10 px (§g-45).
 * - On release the pointer decides membership (R6). With ⌥ (FR-009, 051 R2) the drag duplicates:
 *   as soon as ⌥ is active the originals go back to their start and copies are pasted where they
 *   are, inside the open gesture, and the copies move instead; releasing ⌥ removes them again.
 *   Esc or a window blur cancels: the document is restored and no undo entry is left (R14).
 *
 * The session lives in a handler ref for the length of one drag; guides, the drop target and the
 * offset readout are UI-only store fields. Nothing here is document state.
 */
import {
  imageBox,
  isLocked,
  isSchemaGroupId,
  STICKY_DEFAULT_OFFSET,
  stickyBox,
  stickyCanvasPosition,
  viewNodePosition,
  type DeckEditor,
} from '@sododeck/model';
import type { Frame, Id } from '@sododeck/schema';
import type { NodeChange } from '@xyflow/react';

import { readDeck } from '../../model/use-deck-snapshot';
import { useUiStore, type CanvasGesture, type Guide, type Selection } from '../../state/ui-store';
import {
  cardSize,
  displayPosition,
  groupBounds,
  nodeSize,
  type Point,
  type Rect,
} from '../canvas-geometry';
import { GROUP_NODE_PREFIX, IMAGE_NODE_PREFIX, STICKY_NODE_PREFIX } from '../deck-to-flow';
import { effectiveLevel, levelForZoom } from '../levels';
import { scopeOf, visibleGraph } from '../visible-graph';
import { readViewState } from '../views/use-current-view';
import { duplicatedText, selectionFragment } from './clipboard-ops';
import { commonParent } from './common-parent';
import { dropTarget, frameEntries, type FrameEntry } from './drop-target';
import { lockedGroupIds } from '../group-lock';
import { refuseLocked } from '../lock';
import { equalGaps, nearestGap } from './gaps';
import { membershipChanges, type MembershipChange } from './membership-changes';
import { snap, snapCandidates, type SnapCandidates } from './snap';
import { groupSubtree, groupSubtreeImages } from './subtree';

/** DESIGN.md "Snap guide": within 6 screen px. */
const SNAP_SCREEN_PX = 6;

export interface DragDeps {
  editor: DeckEditor;
  getViewport: () => { x: number; y: number; zoom: number };
  screenToFlowPosition: (point: Point) => Point;
  /** Shows a message with an Undo button (a group nested by drag). */
  undoToast: (message: string) => void;
  /** Size of the canvas on screen (candidates for snapping are the cards on screen). */
  canvasSize: () => { width: number; height: number };
}

interface Mods {
  alt: boolean;
  shift: boolean;
  mod: boolean;
}

export interface DragSession {
  viewId: Id;
  /** The React Flow node the pointer holds. */
  anchor: string;
  /** Dragged components (the selection), and dragged groups (their subtrees move along). */
  nodes: readonly Id[];
  groups: readonly Id[];
  /** Dragged images (055): the selected ones; those inside a dragged group move along too. */
  images: readonly Id[];
  /** Where every moving component and frame started, as the view draws them. */
  start: Readonly<Record<Id, Point>>;
  frames: Readonly<Record<Id, Frame>>;
  /** Where every moving image started (the selected ones and the members of dragged groups). */
  imageStart: Readonly<Record<Id, Point>>;
  /** Dragged notes: the selected ones (copied with ⌥ even when they do not move themselves). */
  stickies: readonly Id[];
  /**
   * The stored `position` of every note that moves itself: a free note's point, a pinned note's
   * offset (pinned to a card that is not moving). A note pinned to a moving card follows it.
   */
  stickyStart: Readonly<Record<Id, Point>>;
}

/** The copies of an ⌥ duplicate-drag (051 R2): they move instead of the originals. */
interface Copies {
  nodes: readonly Id[];
  groups: readonly Id[];
  images: readonly Id[];
  imageStart: Readonly<Record<Id, Point>>;
  stickies: readonly Id[];
  stickyStart: Readonly<Record<Id, Point>>;
  /** Where the copies start (the originals' start): the drag delta applies to these. */
  start: Readonly<Record<Id, Point>>;
  frames: Readonly<Record<Id, Frame>>;
}

interface Session extends DragSession {
  kind: 'nodes' | 'group';
  level: ReturnType<typeof effectiveLevel>;
  /** `null` while moving the originals; the copies while duplicating. */
  copies: Copies | null;
  anchorStart: Point;
  /** Union of everything that moves, at the start. */
  box: Rect;
  candidates: SnapCandidates;
  others: readonly Rect[];
  threshold: number;
  targets: readonly FrameEntry[];
  excluded: ReadonlySet<Id>;
  scope: Id | undefined;
  /** The anchor's own group: dropping back into it is no change. */
  home: Id | undefined;
  mods: Mods;
  arrow: Point;
  lastRaw: Point | null;
  pointer: Point | null;
  delta: Point;
  moved: boolean;
  cancelled: boolean;
}

const plural = (n: number, noun: string) => `${String(n)} ${noun}${n === 1 ? '' : 's'}`;

function union(rects: readonly Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** The Esc, arrow and (segment drags only) R handlers of the drag in progress, for the keyboard
 * map. `reset` is only set by a segment drag (017 R7): other gestures have no reset action. */
let active: {
  cancel: () => boolean;
  arrow: (dx: number, dy: number) => boolean;
  reset?: () => boolean;
} | null = null;

/** Listeners told when a gesture is registered or ends (the guides' render guard, 050 R9). */
const gestureListeners = new Set<() => void>();

function setActive(handlers: typeof active): void {
  if (handlers === active) return;
  active = handlers;
  for (const listener of gestureListeners) listener();
}

/** Esc during a drag or a resize (R14): cancels it. Returns whether one was running. */
export function cancelActiveGesture(): boolean {
  return active?.cancel() ?? false;
}

/** Arrows during a pointer drag (§g-45): nudge the drag by 1 / 10 px. */
export function nudgeActiveDrag(dx: number, dy: number): boolean {
  return active?.arrow(dx, dy) ?? false;
}

/** R during a segment drag (017 R7, FR-014): resets it to automatic routing. Returns whether one
 * was running with a reset action (other gestures ignore R). */
export function resetActiveGesture(): boolean {
  return active?.reset?.() ?? false;
}

/**
 * Whether a pointer gesture (drag, resize, bend, label, end or segment drag) is registered.
 * The guide safety net (050 R9) clears leftover previews only when this is false.
 */
export function hasActiveGesture(): boolean {
  return active !== null;
}

/** Subscribes to `hasActiveGesture()` changes (for `useSyncExternalStore`). */
export function subscribeActiveGesture(listener: () => void): () => void {
  gestureListeners.add(listener);
  return () => {
    gestureListeners.delete(listener);
  };
}

/** Registers the cancel of a resize, which is not a drag session (see `frame-resize.ts`). */
export function setActiveGesture(handlers: typeof active): void {
  setActive(handlers);
}

const pointOf = (rect: Rect | undefined): Point | undefined =>
  rect === undefined ? undefined : { x: rect.x, y: rect.y };

export class DragController {
  private session: Session | null = null;
  private readonly onKey = (event: KeyboardEvent) => {
    const session = this.session;
    if (session === null) return;
    const mods = { alt: event.altKey, shift: event.shiftKey, mod: event.metaKey || event.ctrlKey };
    if (
      mods.alt === session.mods.alt &&
      mods.shift === session.mods.shift &&
      mods.mod === session.mods.mod
    ) {
      return;
    }
    session.mods = mods;
    this.updateTarget();
    if (session.lastRaw !== null) this.apply(session.lastRaw);
  };

  /** Leaving the window mid-drag (050 R9): like Esc, so no guide or half-move is left behind. */
  private readonly onBlur = () => {
    this.cancel();
  };

  constructor(private deps: DragDeps) {}

  /** The latest canvas callbacks, after a re-render; a running drag keeps its session. */
  update(inputs: Pick<DragDeps, 'getViewport' | 'screenToFlowPosition' | 'undoToast'>): void {
    this.deps = { ...this.deps, ...inputs };
  }

  get dragging(): boolean {
    return this.session !== null;
  }

  /** A drag of the selected components (and selected groups, if the selection is mixed). */
  startNodes(anchor: Id): void {
    const { selection } = useUiStore.getState();
    this.begin(anchor, 'nodes', selection, undefined);
  }

  /**
   * A drag of a group by its label or edge, or by its collapsed card (`via`: the card's flow id
   * and position, which then lead the drag): the selected groups, or just this one.
   */
  startGroup(groupId: Id, via?: { id: string; position: Point }): void {
    const ui = useUiStore.getState();
    if (!ui.selection.groups.includes(groupId)) ui.select({ groups: [groupId] });
    const { selection } = useUiStore.getState();
    this.begin(via?.id ?? `${GROUP_NODE_PREFIX}${groupId}`, 'group', selection, {
      groupId,
      ...(via === undefined ? {} : { position: via.position }),
    });
  }

  private begin(
    anchor: string,
    kind: Session['kind'],
    selection: Pick<Selection, 'nodes' | 'groups' | 'images' | 'stickies'>,
    group?: { groupId: Id; position?: Point },
  ) {
    const { nodes, groups, images } = selection;
    // React Flow skips the stop of an aborted drag: never leave its gesture open.
    if (this.session !== null) this.stop();
    const { editor, getViewport } = this.deps;
    const view = readViewState(editor.doc);
    const deck = readDeck(editor.doc);
    // A locked group refuses to move (054); the frame is not draggable either, this is the
    // backstop for a selection drag that still carries one.
    const lockedGroups = lockedGroupIds(deck);
    if (group !== undefined && lockedGroups.has(group.groupId)) {
      useUiStore.getState().setCanvasGesture(null);
      refuseLocked();
      return;
    }
    const movable = groups.filter((id) => !lockedGroups.has(id));
    const ui = useUiStore.getState();
    const scope = scopeOf(ui.drill);
    const zoom = getViewport().zoom;
    const level = effectiveLevel(levelForZoom(zoom), scope);
    const bounds = groupBounds(view.deck, level);

    const tree = groupSubtree(deck, movable);
    // A derived schema frame (048) stores nothing: dragging it moves its tables, never a frame.
    const schemaIds = new Set(movable.filter(isSchemaGroupId));
    const schemaMembers = view.deck.nodes
      .filter((node) => node.group !== undefined && schemaIds.has(node.group))
      .map((node) => node.id);
    // Locked cards stay put in a multi-drag (043 FR-024); a group still carries its members.
    const locked = new Set(deck.nodes.filter(isLocked).map((node) => node.id));
    const moving = new Set([
      ...nodes.filter((id) => !locked.has(id)),
      ...tree.nodes,
      ...schemaMembers,
    ]);
    const start: Record<Id, Point> = {};
    const movingBoxes: Rect[] = [];
    deck.nodes.forEach((node, index) => {
      if (!moving.has(node.id)) return;
      const at = viewNodePosition(view.view, node) ?? displayPosition(node, index);
      start[node.id] = at;
      movingBoxes.push({ ...at, ...cardSize(node, level) });
    });
    // Images (055): the selected ones that are not locked, and the members of dragged groups.
    const deckImages = deck.images ?? [];
    const lockedImages = new Set(deckImages.filter(isLocked).map((image) => image.id));
    const draggedImages = images.filter((id) => !lockedImages.has(id));
    const movingImages = new Set([...draggedImages, ...groupSubtreeImages(deck, movable)]);
    const imageStart: Record<Id, Point> = {};
    for (const image of deckImages) {
      if (!movingImages.has(image.id)) continue;
      imageStart[image.id] = image.position;
      movingBoxes.push(imageBox(image));
    }
    // Notes: the selected ones that are not locked. A note pinned to a moving card follows it.
    const draggedStickies = new Set(selection.stickies);
    const stickyStart: Record<Id, Point> = {};
    const stickyDrawn: Record<Id, Point> = {};
    for (const sticky of view.deck.stickies) {
      if (!draggedStickies.has(sticky.id) || isLocked(sticky)) continue;
      const placement = stickyCanvasPosition(view.deck, sticky);
      stickyDrawn[sticky.id] = placement.point;
      movingBoxes.push(stickyBox(sticky, placement.point));
      if (placement.status === 'pinned' && moving.has(placement.pinnedTo)) continue;
      stickyStart[sticky.id] =
        sticky.position ?? (sticky.anchor === undefined ? { x: 0, y: 0 } : STICKY_DEFAULT_OFFSET);
    }
    const frames: Record<Id, Frame> = {};
    for (const id of tree.groups) {
      const rect = bounds.get(id);
      if (rect !== undefined) {
        frames[id] = {
          position: { x: rect.x, y: rect.y },
          size: { width: rect.width, height: rect.height },
        };
      }
    }
    const anchorIsImage = anchor.startsWith(IMAGE_NODE_PREFIX);
    const anchorIsSticky = anchor.startsWith(STICKY_NODE_PREFIX);
    const anchorId =
      group?.groupId ??
      (anchorIsImage
        ? anchor.slice(IMAGE_NODE_PREFIX.length)
        : anchorIsSticky
          ? anchor.slice(STICKY_NODE_PREFIX.length)
          : anchor);
    const anchorStart =
      kind === 'group'
        ? (group?.position ??
          frames[anchorId]?.position ??
          pointOf(bounds.get(anchorId)) ?? { x: 0, y: 0 })
        : anchorIsImage
          ? imageStart[anchorId]
          : anchorIsSticky
            ? stickyDrawn[anchorId]
            : start[anchorId];
    if (anchorStart === undefined) return;

    // Snapping looks at the components on screen that are not moving (R7).
    const graph = visibleGraph(view.deck, scope, view.collapsed);
    const vp = getViewport();
    const screen = this.deps.canvasSize();
    const onScreen: Rect = {
      x: -vp.x / vp.zoom,
      y: -vp.y / vp.zoom,
      width: screen.width / vp.zoom,
      height: screen.height / vp.zoom,
    };
    const visible = new Set(graph.nodes);
    const others: Rect[] = [];
    view.deck.nodes.forEach((node, index) => {
      if (!visible.has(node.id) || moving.has(node.id)) return;
      const rect = { ...displayPosition(node, index), ...cardSize(node, level) };
      const inView =
        screen.width === 0 ||
        (rect.x + rect.width >= onScreen.x &&
          rect.x <= onScreen.x + onScreen.width &&
          rect.y + rect.height >= onScreen.y &&
          rect.y <= onScreen.y + onScreen.height);
      if (inView) others.push(rect);
    });
    for (const image of view.deck.images ?? []) {
      if (movingImages.has(image.id) || graph.hiddenImages.has(image.id)) continue;
      others.push(imageBox(image));
    }
    const box = union([
      ...movingBoxes,
      ...Object.values(frames).map((f) => ({ ...f.position, ...f.size })),
    ]);

    const excluded = new Set(tree.groups);
    this.session = {
      viewId: view.view.id,
      anchor,
      kind,
      level,
      copies: null,
      nodes,
      groups: movable,
      images: draggedImages,
      start,
      frames,
      imageStart,
      stickies: Object.keys(stickyDrawn),
      stickyStart,
      anchorStart,
      box,
      candidates: snapCandidates(others),
      others,
      threshold: SNAP_SCREEN_PX / (zoom > 0 ? zoom : 1),
      // A derived schema frame (048) is not a group a card can be dropped into.
      targets: frameEntries(
        view.deck,
        bounds,
        graph.groups.filter((id) => !isSchemaGroupId(id)),
      ),
      excluded,
      scope: scope.group ?? undefined,
      home:
        kind === 'group'
          ? deck.groups.find((g) => g.id === anchorId)?.parent
          : anchorIsImage
            ? deckImages.find((i) => i.id === anchorId)?.group
            : anchorIsSticky
              ? undefined
              : deck.nodes.find((n) => n.id === anchorId)?.group,
      mods: { alt: false, shift: false, mod: false },
      arrow: { x: 0, y: 0 },
      lastRaw: null,
      pointer: null,
      delta: { x: 0, y: 0 },
      moved: false,
      cancelled: false,
    };
    editor.beginGesture();
    const gesture: CanvasGesture = kind === 'group' ? 'group-drag' : 'drag';
    ui.setCanvasGesture(gesture);
    document.addEventListener('keydown', this.onKey, true);
    document.addEventListener('keyup', this.onKey, true);
    window.addEventListener('blur', this.onBlur);
    setActive({
      cancel: () => this.cancel(),
      arrow: (dx, dy) => this.arrow(dx, dy),
    });
  }

  /**
   * Takes React Flow's position changes for this drag: the anchor's position becomes the delta
   * applied to everything. Returns the changes it did not handle (notes, other kinds).
   */
  change(changes: NodeChange[]): NodeChange[] {
    const session = this.session;
    if (session === null) return changes;
    const moving = new Set([
      ...Object.keys(session.start),
      ...Object.keys(session.imageStart).map((id) => `${IMAGE_NODE_PREFIX}${id}`),
      // Every dragged note, also one that follows its card: the controller moves notes itself.
      ...session.stickies.map((id) => `${STICKY_NODE_PREFIX}${id}`),
      session.anchor,
    ]);
    const rest: NodeChange[] = [];
    for (const change of changes) {
      if (change.type !== 'position') {
        rest.push(change);
        continue;
      }
      if (change.id === session.anchor) {
        if (change.position !== undefined && !session.cancelled) this.apply(change.position);
        continue;
      }
      // Everything else that moves with the drag follows the anchor, not its own report.
      if (moving.has(change.id) || change.id.startsWith(GROUP_NODE_PREFIX)) continue;
      rest.push(change);
    }
    return rest;
  }

  /** The pointer and modifier keys of a drag event: they decide the drop target. */
  pointer(event: {
    clientX: number;
    clientY: number;
    altKey?: boolean;
    shiftKey?: boolean;
    metaKey?: boolean;
    ctrlKey?: boolean;
  }): void {
    const session = this.session;
    if (session === null) return;
    session.pointer = this.deps.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const mods = {
      alt: event.altKey === true,
      shift: event.shiftKey === true,
      mod: event.metaKey === true || event.ctrlKey === true,
    };
    const changed =
      mods.alt !== session.mods.alt ||
      mods.shift !== session.mods.shift ||
      mods.mod !== session.mods.mod;
    session.mods = mods;
    this.updateTarget();
    if (changed && session.lastRaw !== null) this.apply(session.lastRaw);
  }

  private targetAt(point: Point | null): Id | null {
    const session = this.session;
    if (session === null || point === null) return null;
    return dropTarget(session.targets, point, session.excluded);
  }

  /** The anchor card's centre now: where it drops when no pointer was reported. */
  private anchorCentre(): Point {
    const session = this.session;
    if (session === null) return { x: 0, y: 0 };
    const x = session.anchorStart.x + session.delta.x;
    const y = session.anchorStart.y + session.delta.y;
    if (session.kind === 'group') return { x, y };
    const level = effectiveLevel(levelForZoom(this.deps.getViewport().zoom), scopeOf([]));
    const deck = readDeck(this.deps.editor.doc);
    if (session.anchor.startsWith(STICKY_NODE_PREFIX)) {
      const id = session.anchor.slice(STICKY_NODE_PREFIX.length);
      const sticky = deck.stickies.find((s) => s.id === id);
      if (sticky !== undefined) {
        const box = stickyBox(sticky, { x, y });
        return { x: x + box.width / 2, y: y + box.height / 2 };
      }
    }
    if (session.anchor.startsWith(IMAGE_NODE_PREFIX)) {
      const id = session.anchor.slice(IMAGE_NODE_PREFIX.length);
      const image = (deck.images ?? []).find((i) => i.id === id);
      if (image !== undefined) {
        const box = imageBox(image);
        return { x: x + box.width / 2, y: y + box.height / 2 };
      }
    }
    const anchorNode = deck.nodes.find((n) => n.id === session.anchor);
    const size = anchorNode === undefined ? nodeSize(level) : cardSize(anchorNode, level);
    return { x: x + size.width / 2, y: y + size.height / 2 };
  }

  private updateTarget(): void {
    const session = this.session;
    if (session === null) return;
    const target = session.mods.alt ? null : this.targetAt(session.pointer);
    // The own group is no change: no "Drop into" there (screen 110).
    useUiStore.getState().setDropTarget(target === session.home ? null : target);
  }

  /** One frame. If it throws, the guides go before the error does (050 R9). */
  private apply(raw: Point): void {
    try {
      this.applyFrame(raw);
    } catch (error) {
      this.clearUi();
      throw error;
    }
  }

  private applyFrame(raw: Point): void {
    const session = this.session;
    if (session === null) return;
    session.lastRaw = raw;
    let dx = raw.x - session.anchorStart.x + session.arrow.x;
    let dy = raw.y - session.anchorStart.y + session.arrow.y;
    let lock: 'x' | 'y' | null = null;
    if (session.mods.shift) {
      lock = Math.abs(dx) >= Math.abs(dy) ? 'y' : 'x';
      if (lock === 'y') dy = 0;
      else dx = 0;
    }
    let guides: Guide[] = [];
    if (!session.mods.mod) {
      const moved = { ...session.box, x: session.box.x + dx, y: session.box.y + dy };
      const result = snap(moved, session.candidates, session.threshold);
      const sx = lock === 'x' ? 0 : result.dx;
      const sy = lock === 'y' ? 0 : result.dy;
      dx += sx;
      dy += sy;
      const box = { ...moved, x: moved.x + sx, y: moved.y + sy };
      guides = result.guides
        .filter((g) => (g.axis === 'x' ? lock !== 'x' : lock !== 'y'))
        .map((guide) => withLabels(guide, box, session.others));
    }
    dx = Math.round(dx);
    dy = Math.round(dy);
    session.delta = { x: dx, y: dy };
    session.moved = session.moved || dx !== 0 || dy !== 0;

    // ⌥ once the drag has moved: copies move, originals rest; ⌥ released: back to a move.
    if (session.mods.alt && session.moved && session.copies === null) this.startCopies(session);
    else if (!session.mods.alt && session.copies !== null) this.dropCopies(session);
    const start = session.copies?.start ?? session.start;
    const startFrames = session.copies?.frames ?? session.frames;

    const { editor } = this.deps;
    const positions: Record<Id, Point> = {};
    for (const [id, p] of Object.entries(start)) positions[id] = { x: p.x + dx, y: p.y + dy };
    const frames: Record<Id, Frame> = {};
    for (const [id, f] of Object.entries(startFrames)) {
      frames[id] = { position: { x: f.position.x + dx, y: f.position.y + dy }, size: f.size };
    }
    const imageStart = session.copies?.imageStart ?? session.imageStart;
    const stickyStart = session.copies?.stickyStart ?? session.stickyStart;
    editor.batch(() => {
      for (const [id, p] of Object.entries(imageStart)) {
        editor.moveImage(id, { x: p.x + dx, y: p.y + dy });
      }
      // The stored point moves by the delta: a free note's point or a pinned note's offset.
      for (const [id, p] of Object.entries(stickyStart)) {
        editor.update('stickies', id, { position: { x: p.x + dx, y: p.y + dy } });
      }
      if (Object.keys(positions).length > 0) editor.moveInView(session.viewId, positions);
      if (Object.keys(frames).length > 0) editor.setGroupFrames(session.viewId, frames);
    });
    const ui = useUiStore.getState();
    ui.setGuides(guides);
    if (session.kind === 'group') ui.setDragReadout({ dx, dy });
    if (session.pointer === null) this.updateTarget();
  }

  /**
   * Enters the duplicate mode (051 R2), inside the drag's gesture: the originals go back to their
   * start and copies are pasted there, in the originals' innermost common group; the next write
   * moves the copies by the current delta. Called once per switch, never per frame.
   */
  private startCopies(session: Session): void {
    const { editor } = this.deps;
    editor.batch(() => {
      editor.moveInView(session.viewId, session.start);
      if (Object.keys(session.frames).length > 0)
        editor.setGroupFrames(session.viewId, session.frames);
      for (const [id, p] of Object.entries(session.imageStart)) editor.moveImage(id, p);
      for (const [id, p] of Object.entries(session.stickyStart)) {
        editor.update('stickies', id, { position: p });
      }
    });
    const deck = readDeck(editor.doc);
    const fragment = selectionFragment(deck, session, session.viewId);
    if (fragment === null) return;
    const ids = editor.pasteFragment(fragment, {
      offset: { x: 0, y: 0 },
      parent: commonParent(deck, session),
      viewId: session.viewId,
    });
    // The copies sit exactly on the originals' start: read their positions and frames back.
    const view = readViewState(editor.doc);
    const pasted = new Set(ids.nodes);
    const start: Record<Id, Point> = {};
    view.deck.nodes.forEach((node, index) => {
      if (pasted.has(node.id))
        start[node.id] = viewNodePosition(view.view, node) ?? displayPosition(node, index);
    });
    const bounds = groupBounds(view.deck, session.level);
    const frames: Record<Id, Frame> = {};
    for (const id of ids.groups) {
      const rect = bounds.get(id);
      if (rect !== undefined) {
        frames[id] = {
          position: { x: rect.x, y: rect.y },
          size: { width: rect.width, height: rect.height },
        };
      }
    }
    const pastedImages = new Set(ids.images);
    const imageStart: Record<Id, Point> = {};
    for (const image of view.deck.images ?? []) {
      if (pastedImages.has(image.id)) imageStart[image.id] = image.position;
    }
    // Copied notes are free notes at the point the originals are drawn (the model's fragment).
    const pastedStickies = new Set(ids.stickies);
    const stickyStart: Record<Id, Point> = {};
    for (const sticky of view.deck.stickies) {
      if (pastedStickies.has(sticky.id) && sticky.position !== undefined) {
        stickyStart[sticky.id] = sticky.position;
      }
    }
    session.copies = {
      nodes: ids.nodes,
      groups: ids.groups,
      images: ids.images,
      imageStart,
      stickies: ids.stickies,
      stickyStart,
      start,
      frames,
    };
    useUiStore.getState().setDragCopyIds([...ids.nodes, ...ids.groups]);
  }

  /** Leaves the duplicate mode (⌥ released mid-drag): exactly the copies go, inside the gesture. */
  private dropCopies(session: Session): void {
    const copies = session.copies;
    if (copies === null) return;
    const { editor } = this.deps;
    editor.batch(() => {
      for (const id of copies.nodes) {
        if (readDeck(editor.doc).nodes.some((n) => n.id === id)) editor.remove('nodes', id);
      }
      for (const id of copies.images) {
        if ((readDeck(editor.doc).images ?? []).some((i) => i.id === id))
          editor.remove('images', id);
      }
      for (const id of copies.stickies) {
        if (readDeck(editor.doc).stickies.some((n) => n.id === id)) editor.remove('stickies', id);
      }
      // Pasted parents come first: remove the innermost copies first.
      for (const id of [...copies.groups].reverse()) {
        if (readDeck(editor.doc).groups.some((g) => g.id === id)) editor.remove('groups', id);
      }
    });
    session.copies = null;
    useUiStore.getState().clearDragCopyIds();
  }

  private arrow(dx: number, dy: number): boolean {
    const session = this.session;
    if (session === null || session.cancelled) return false;
    session.arrow = { x: session.arrow.x + dx, y: session.arrow.y + dy };
    this.apply(session.lastRaw ?? session.anchorStart);
    return true;
  }

  /** Esc: back to the start, no undo entry; the rest of the drag is ignored. */
  cancel(): boolean {
    const session = this.session;
    if (session === null || session.cancelled) return false;
    session.cancelled = true;
    this.deps.editor.cancelGesture();
    this.clearUi();
    useUiStore.getState().announce('Cancelled');
    return true;
  }

  /** Release: the copies made with ⌥ stay, otherwise the membership the pointer decides. */
  stop(event?: { clientX?: number; clientY?: number }): void {
    const session = this.session;
    if (session === null) return;
    if (!session.cancelled) {
      if (event?.clientX !== undefined && event.clientY !== undefined) {
        session.pointer = this.deps.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      }
      if (session.copies !== null) {
        const ui = useUiStore.getState();
        ui.select({
          nodes: [...session.copies.nodes],
          groups: [...session.copies.groups],
          images: [...session.copies.images],
          stickies: [...session.copies.stickies],
        });
        ui.announce(duplicatedText(session.copies));
      } else if (session.moved) {
        this.drop(session);
      }
      this.deps.editor.endGesture();
    }
    this.end();
  }

  private drop(session: Session): void {
    const { editor, undoToast } = this.deps;
    const deck = readDeck(editor.doc);
    const target = this.targetAt(session.pointer ?? this.anchorCentre());
    const changes = membershipChanges(deck, session, {
      target,
      scope: session.scope,
      keep: false,
    });
    if (changes.length === 0) return;
    editor.batch(() => {
      for (const change of changes) {
        if (change.kind === 'node') editor.update('nodes', change.id, { group: change.to ?? null });
        else if (change.kind === 'image') editor.setImageGroup(change.id, change.to ?? null);
        else editor.update('groups', change.id, { parent: change.to ?? null });
      }
    });
    const message = moveMessage(deck, changes);
    useUiStore.getState().announce(message);
    if (changes.some((c) => c.kind === 'group' && c.to !== undefined)) undoToast(message);
  }

  private clearUi(): void {
    const ui = useUiStore.getState();
    ui.clearDragCopyIds();
    ui.setGuides([]);
    ui.setDropTarget(null);
    ui.setDragReadout(null);
  }

  private end(): void {
    this.clearUi();
    const ui = useUiStore.getState();
    if (ui.canvasGesture === 'drag' || ui.canvasGesture === 'group-drag') ui.setCanvasGesture(null);
    document.removeEventListener('keydown', this.onKey, true);
    document.removeEventListener('keyup', this.onKey, true);
    window.removeEventListener('blur', this.onBlur);
    setActive(null);
    this.session = null;
  }
}

/** A guide with its distance and equal-gap labels, measured along the guide (R7). */
function withLabels(guide: Guide, box: Rect, others: readonly Rect[]): Guide {
  const axis = guide.axis === 'x' ? 'y' : 'x';
  const distance = nearestGap(box, others, axis);
  const gaps = equalGaps(box, others, axis);
  return {
    ...guide,
    ...(distance === null ? {} : { distance }),
    ...(gaps.length === 0 ? {} : { equalGaps: gaps }),
  };
}

/** "Moved Fraud check into Payments" / "Moved 3 components out of Payments" (contract). */
export function moveMessage(
  deck: Pick<ReturnType<typeof readDeck>, 'nodes' | 'groups'> &
    Partial<Pick<ReturnType<typeof readDeck>, 'images'>>,
  changes: readonly MembershipChange[],
): string {
  const title = (change: MembershipChange) =>
    change.kind === 'node'
      ? (deck.nodes.find((n) => n.id === change.id)?.title ?? change.id)
      : change.kind === 'image'
        ? 'image'
        : (deck.groups.find((g) => g.id === change.id)?.title ?? change.id);
  const groupTitle = (id: Id) => deck.groups.find((g) => g.id === id)?.title ?? id;
  const [first] = changes;
  if (first === undefined) return '';
  const what = changes.length === 1 ? title(first) : plural(changes.length, 'item');
  if (first.to !== undefined) return `Moved ${what} into ${groupTitle(first.to)}`;
  return first.from === undefined
    ? `Moved ${what}`
    : `Moved ${what} out of ${groupTitle(first.from)}`;
}

/**
 * Dragging a connector end (050 R3, R11): slide it along its card, send it back to automatic, or
 * reconnect it to another card. It replaces React Flow's reconnect.
 *
 * 1. On press the offset between the pointer and the end is kept, so pressing never moves the end
 *    (FR-007).
 * 2. Each frame, the pointer minus that offset is hit-tested against the drawn targets
 *    (`hitTarget`) and attached to the target's outline (`attachToOutline`). The live result is
 *    UI-only (`endpointPreview`, `connectorReadout`); `DeckEdge` draws the connector to it.
 * 3. Release writes once, as one undo step: `from` / `to` when the target changed, plus the pinned
 *    side and position, or a cleared side for "automatic". An unchanged result, a refusal or a
 *    release off every target writes nothing and says why. Esc, blur and `pointercancel` drop the
 *    preview.
 *
 * Groups: `hitTarget` returns them, but an end lands on one only with `allowGroups` (default
 * `GROUP_ENDS`, off until 050 T030); otherwise a group counts as no target.
 */
import { endpointOf, type DeckEditor } from '@sododeck/model';
import type { Id, Side, SododeckFile } from '@sododeck/schema';

import { readDeck } from '../../model/use-deck-snapshot';
import { useUiStore, type EndpointPreview } from '../../state/ui-store';
import { connectionCheck, REFUSAL_TEXT, type ConnectionCheck } from '../connection-rules';
import { oneStep } from '../fields/one-step';
import { GROUP_ENDS, hitTarget, type TargetScene } from '../routing/endpoint-target';
import { attachToOutline } from '../routing/outline-attach';
import type { Point } from '../routing/route-path';
import { anchorReadout } from './anchor-drag';
import { setActiveGesture } from './drag-session';

export const NOT_CONNECTED = 'Not connected: drop on a card or group';

/** Everything an end drag needs about one connector end, as the canvas draws it. */
export interface EndpointContext {
  edgeId: Id;
  end: 'source' | 'target';
  /** What the end is attached to now (a node or group id). */
  ownId: Id;
  /** The id at the connector's other end, for the connection rules. */
  otherId: Id;
  /** Where the end is drawn now, in canvas px. */
  start: Point;
  /** The stored pin of this end: no side means automatic; no `at` means the side's middle. */
  side?: Side | undefined;
  at?: number | undefined;
  /** The drawn targets (`targetScene(getNodes())`), taken when the drag starts. */
  scene: TargetScene;
  /** Whether a group may take the end. Defaults to `GROUP_ENDS`. */
  allowGroups?: boolean;
}

export interface EndpointSession {
  ctx: EndpointContext;
  /** End minus pointer at press time (FR-007). */
  offset: Point;
  /** The deck when the drag started: titles and connection rules. */
  deck: SododeckFile;
  preview: EndpointPreview | null;
  cancelled: boolean;
}

function titleOf(deck: SododeckFile, id: Id): string {
  const end = endpointOf(deck, id);
  if (end === null) return id;
  return end.kind === 'group' ? `${end.title} (group)` : end.title;
}

function clearGesture(): void {
  setActiveGesture(null);
  const ui = useUiStore.getState();
  if (ui.canvasGesture === 'endpoint') ui.setCanvasGesture(null);
  ui.setEndpointPreview(null);
  ui.setConnectorReadout(null);
}

/** Starts an end drag. `pointer` is where the press was (canvas px), not where the drag began. */
export function startEndpointDrag(
  editor: DeckEditor,
  ctx: EndpointContext,
  pointer: Point,
): EndpointSession {
  const session: EndpointSession = {
    ctx,
    offset: { x: ctx.start.x - pointer.x, y: ctx.start.y - pointer.y },
    deck: readDeck(editor.doc),
    preview: null,
    cancelled: false,
  };
  useUiStore.getState().setCanvasGesture('endpoint');
  setActiveGesture({
    cancel: () => {
      if (session.cancelled) return false;
      cancelEndpointDrag(session);
      useUiStore.getState().announce('Cancelled');
      return true;
    },
    arrow: () => false,
  });
  return session;
}

/** One frame: the pointer (canvas px) becomes the end's live attachment. */
export function moveEndpoint(
  session: EndpointSession,
  pointer: Point,
  opts: { mod: boolean; zoom: number },
): void {
  if (session.cancelled) return;
  const { ctx, deck } = session;
  const p = { x: pointer.x + session.offset.x, y: pointer.y + session.offset.y };
  const hit = hitTarget(p, ctx.scene, opts.zoom);
  const target = hit?.kind === 'group' && !(ctx.allowGroups ?? GROUP_ENDS) ? null : hit;
  const ui = useUiStore.getState();
  if (target === null) {
    session.preview = {
      edgeId: ctx.edgeId,
      end: ctx.end,
      targetId: null,
      targetKind: null,
      box: null,
      side: session.preview?.side ?? ctx.side ?? 'top',
      at: 0.5,
      point: p,
      snapped: false,
      automatic: false,
      valid: 'none',
    };
    ui.setEndpointPreview(session.preview);
    ui.setConnectorReadout(null);
    return;
  }
  const own = target.id === ctx.ownId;
  const attach = attachToOutline(target.box, target.geometry, p, {
    zoom: opts.zoom,
    mod: opts.mod,
    allowAutomatic: own,
  });
  const [from, to] = ctx.end === 'source' ? [target.id, ctx.otherId] : [ctx.otherId, target.id];
  const valid: ConnectionCheck = own ? 'ok' : connectionCheck(deck, from, to, ctx.edgeId);
  session.preview = {
    edgeId: ctx.edgeId,
    end: ctx.end,
    targetId: target.id,
    targetKind: target.kind,
    box: target.box,
    ...(target.geometry === undefined ? {} : { geometry: target.geometry }),
    side: attach.side,
    at: attach.at,
    point: attach.point,
    snapped: attach.snapped,
    automatic: attach.automatic,
    valid,
  };
  ui.setEndpointPreview(session.preview);
  ui.setConnectorReadout(
    valid !== 'ok'
      ? REFUSAL_TEXT[valid]
      : !own
        ? `→ ${titleOf(deck, target.id)}`
        : attach.automatic
          ? 'automatic'
          : anchorReadout(attach.side, attach.at, attach.snapped),
  );
}

/** Release: writes once, or nothing (unchanged, refused, off every target, cancelled). */
export function endEndpointDrag(editor: DeckEditor, session: EndpointSession): void {
  // Every exit clears the gesture's UI state (050 R9).
  clearGesture();
  const { ctx, preview } = session;
  if (session.cancelled || preview === null) return;
  const ui = useUiStore.getState();
  if (preview.targetId === null) {
    ui.announce(NOT_CONNECTED);
    return;
  }
  if (preview.valid !== 'ok' && preview.valid !== 'none') {
    ui.announce(REFUSAL_TEXT[preview.valid]);
    return;
  }
  const source = ctx.end === 'source';
  const sideKey = source ? 'fromSide' : 'toSide';
  const atKey = source ? 'fromAt' : 'toAt';
  if (preview.targetId === ctx.ownId) {
    if (preview.automatic) {
      if (ctx.side === undefined) return;
      oneStep(editor, () => {
        editor.setEdgeRoute(ctx.edgeId, { [sideKey]: null });
      });
      ui.announce('End back to automatic');
      return;
    }
    if (ctx.side === preview.side && (ctx.at ?? 0.5) === preview.at) return;
    oneStep(editor, () => {
      editor.setEdgeRoute(ctx.edgeId, { [sideKey]: preview.side, [atKey]: preview.at });
    });
    ui.announce(`Anchor ${anchorReadout(preview.side, preview.at)}`);
    return;
  }
  const targetId = preview.targetId;
  oneStep(editor, () => {
    editor.update('edges', ctx.edgeId, source ? { from: targetId } : { to: targetId });
    // Another card: 017's middle-segment offset belonged to the old geometry.
    editor.setEdgeRoute(ctx.edgeId, { [sideKey]: preview.side, [atKey]: preview.at, offset: null });
  });
  ui.select({ edges: [ctx.edgeId] });
  const name = endpointOf(session.deck, targetId)?.title ?? targetId;
  ui.announce(`Connection now ${source ? 'leaves' : 'enters'} ${name}`);
}

/** Esc, blur, `pointercancel` or unmount: nothing was written, so dropping the preview is all. */
export function cancelEndpointDrag(session: EndpointSession): void {
  session.cancelled = true;
  clearGesture();
}

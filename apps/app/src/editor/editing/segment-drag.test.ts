import { createEditor, fromJSON, toJSON } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import {
  applySegmentDrag,
  endSegmentDrag,
  resetDuringDrag,
  startSegmentDrag,
} from './segment-drag';

const file = (): SododeckFile => ({
  ...emptySododeckFile(),
  nodes: [
    { id: 'n1', type: 'service', title: 'API Gateway', position: { x: 0, y: 0 } },
    { id: 'n2', type: 'service', title: 'Database', position: { x: 0, y: 300 } },
  ],
  edges: [{ id: 'e1', from: 'n1', to: 'n2' }],
  views: [{ id: 'base', title: 'Base', type: 'custom' }],
});

const initialUi = useUiStore.getState();

function setup() {
  const doc = fromJSON(file());
  return { doc, editor: createEditor(doc) };
}

/** A deck with a third card (`n3`), whose top line sits exactly at `n3Y` (component level). */
function fileWithThird(n3Y: number): SododeckFile {
  return {
    ...file(),
    nodes: [
      { id: 'n1', type: 'service', title: 'API Gateway', position: { x: 0, y: 0 } },
      { id: 'n2', type: 'service', title: 'Database', position: { x: 0, y: 300 } },
      { id: 'n3', type: 'service', title: 'Cache', position: { x: 400, y: n3Y } },
    ],
  };
}

beforeEach(() => {
  useUiStore.setState(initialUi, true);
});

describe('connector middle segment drag (017 R7)', () => {
  it('writes offset = pointer − automatic middle, with no clamp passing over cards', () => {
    const { doc, editor } = setup();
    const session = startSegmentDrag(editor, 'e1', 'component');
    expect(session).not.toBeNull();
    if (session === null) return;
    applySegmentDrag(editor, session, { x: 82, y: session.automaticAt + 60 }, { mod: true }, 1);
    endSegmentDrag(editor, session);
    expect(toJSON(doc).edges.find((e) => e.id === 'e1')?.route?.offset).toBe(60);
  });

  it('is not clamped even far past either card', () => {
    const { doc, editor } = setup();
    const session = startSegmentDrag(editor, 'e1', 'component');
    if (session === null) throw new Error('no session');
    applySegmentDrag(editor, session, { x: 82, y: session.automaticAt + 5000 }, { mod: true }, 1);
    endSegmentDrag(editor, session);
    expect(toJSON(doc).edges.find((e) => e.id === 'e1')?.route?.offset).toBe(5000);
  });

  it('snaps to a candidate card line within 6 screen px', () => {
    const { editor } = setup();
    const session = startSegmentDrag(editor, 'e1', 'component');
    if (session === null) throw new Error('no session');
    const snapTarget = session.automaticAt + 60;

    // A fresh deck with n3's top edge exactly at the snap target, to drag against.
    const doc2 = fromJSON(fileWithThird(snapTarget));
    const editor2 = createEditor(doc2);
    const session2 = startSegmentDrag(editor2, 'e1', 'component');
    if (session2 === null) throw new Error('no session');
    applySegmentDrag(editor2, session2, { x: 82, y: snapTarget + 3 }, { mod: false }, 1);
    endSegmentDrag(editor2, session2);
    expect(toJSON(doc2).edges.find((e) => e.id === 'e1')?.route?.offset).toBe(60);
  });

  it('does not snap with ⌘ held, even within the threshold', () => {
    const { editor } = setup();
    const session = startSegmentDrag(editor, 'e1', 'component');
    if (session === null) throw new Error('no session');
    const snapTarget = session.automaticAt + 60;

    const doc2 = fromJSON(fileWithThird(snapTarget));
    const editor2 = createEditor(doc2);
    const session2 = startSegmentDrag(editor2, 'e1', 'component');
    if (session2 === null) throw new Error('no session');
    applySegmentDrag(editor2, session2, { x: 82, y: snapTarget + 3 }, { mod: true }, 1);
    endSegmentDrag(editor2, session2);
    expect(toJSON(doc2).edges.find((e) => e.id === 'e1')?.route?.offset).toBe(63);
  });

  it('ends as one undo step for the whole drag', () => {
    const { doc, editor } = setup();
    const session = startSegmentDrag(editor, 'e1', 'component');
    if (session === null) throw new Error('no session');
    applySegmentDrag(editor, session, { x: 82, y: session.automaticAt + 20 }, { mod: true }, 1);
    applySegmentDrag(editor, session, { x: 82, y: session.automaticAt + 60 }, { mod: true }, 1);
    endSegmentDrag(editor, session);
    expect(toJSON(doc).edges.find((e) => e.id === 'e1')?.route?.offset).toBe(60);
    expect(editor.undo()).toBe(true);
    expect(toJSON(doc).edges.find((e) => e.id === 'e1')?.route).toBeUndefined();
    expect(editor.undo()).toBe(false);
  });

  it('writes nothing on cancel', () => {
    const { doc, editor } = setup();
    const session = startSegmentDrag(editor, 'e1', 'component');
    if (session === null) throw new Error('no session');
    applySegmentDrag(editor, session, { x: 82, y: session.automaticAt + 60 }, { mod: true }, 1);
    editor.cancelGesture();
    session.cancelled = true;
    expect(toJSON(doc).edges.find((e) => e.id === 'e1')?.route).toBeUndefined();
    expect(editor.undo()).toBe(false);
  });

  it('resetDuringDrag cancels the drag then removes the route as one undo step', () => {
    const { doc, editor } = setup();
    // A route already exists before this drag starts.
    editor.setEdgeRoute('e1', { offset: 40 });
    const session = startSegmentDrag(editor, 'e1', 'component');
    if (session === null) throw new Error('no session');
    applySegmentDrag(editor, session, { x: 82, y: session.automaticAt + 90 }, { mod: true }, 1);
    resetDuringDrag(editor, session);
    expect(toJSON(doc).edges.find((e) => e.id === 'e1')?.route).toBeUndefined();
    expect(editor.undo()).toBe(true);
    expect(toJSON(doc).edges.find((e) => e.id === 'e1')?.route?.offset).toBe(40);
    expect(editor.undo()).toBe(true);
    expect(toJSON(doc).edges.find((e) => e.id === 'e1')?.route).toBeUndefined();
    expect(editor.undo()).toBe(false);
  });

  it('shows a signed offset readout during the drag (via dragReadout), and clears it at the end', () => {
    const { editor } = setup();
    const session = startSegmentDrag(editor, 'e1', 'component');
    if (session === null) throw new Error('no session');
    applySegmentDrag(editor, session, { x: 82, y: session.automaticAt + 60 }, { mod: true }, 1);
    expect(useUiStore.getState().dragReadout).toEqual({ dx: 0, dy: 60 });
    endSegmentDrag(editor, session);
    expect(useUiStore.getState().dragReadout).toBeNull();
  });

  it('announces the final offset, signed', () => {
    const { editor } = setup();
    const session = startSegmentDrag(editor, 'e1', 'component');
    if (session === null) throw new Error('no session');
    applySegmentDrag(editor, session, { x: 82, y: session.automaticAt + 60 }, { mod: true }, 1);
    endSegmentDrag(editor, session);
    expect(useUiStore.getState().announcement.text).toBe('Moved middle segment to +60');
  });

  it('returns null for an edge with no movable middle segment (perpendicular pinned sides)', () => {
    const doc = fromJSON({
      ...file(),
      edges: [{ id: 'e1', from: 'n1', to: 'n2', route: { fromSide: 'top', toSide: 'left' } }],
    });
    const editor = createEditor(doc);
    expect(startSegmentDrag(editor, 'e1', 'component')).toBeNull();
  });
});

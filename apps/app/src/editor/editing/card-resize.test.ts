import { createEditor, fromJSON, toJSON } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { applyCardResize, endCardResize, startCardResize } from './card-resize';

const file = (): SododeckFile => ({
  ...emptySododeckFile(),
  nodes: [
    { id: 'n1', type: 'service', title: 'API Gateway', position: { x: 0, y: 0 } },
    { id: 'n2', type: 'service', title: 'Other', position: { x: 300, y: 0 } },
  ],
  views: [
    { id: 'base', title: 'Base', type: 'custom' },
    { id: 'v2', title: 'View 2', type: 'custom' },
  ],
});

const noMods = { shift: false, alt: false, mod: false };
const initialUi = useUiStore.getState();

function setup() {
  const doc = fromJSON(file());
  return { doc, editor: createEditor(doc) };
}

beforeEach(() => {
  useUiStore.setState(initialUi, true);
});

describe('card resize (017 R4)', () => {
  it('grows from the bottom-right handle, one undo step for the whole drag', () => {
    const { doc, editor } = setup();
    const session = startCardResize(editor, 'n1', 'bottom-right', 'component');
    expect(session).not.toBeNull();
    if (session === null) return;
    applyCardResize(editor, session, { x: 0, y: 0, width: 200, height: 120 }, noMods, 1);
    applyCardResize(editor, session, { x: 0, y: 0, width: 240, height: 140 }, noMods, 1);
    endCardResize(editor, session);
    const node = toJSON(doc).nodes.find((n) => n.id === 'n1');
    expect(node?.size).toEqual({ width: 240, height: 140 });
    expect(editor.undo()).toBe(true);
    expect(toJSON(doc).nodes.find((n) => n.id === 'n1')?.size).toBeUndefined();
    expect(editor.undo()).toBe(false);
  });

  it('moves the position too from a top-left handle', () => {
    const { doc, editor } = setup();
    const session = startCardResize(editor, 'n1', 'top-left', 'component');
    if (session === null) throw new Error('no session');
    applyCardResize(editor, session, { x: -40, y: -20, width: 204, height: 124 }, noMods, 1);
    endCardResize(editor, session);
    const node = toJSON(doc).nodes.find((n) => n.id === 'n1');
    expect(node?.position).toEqual({ x: -40, y: -20 });
    expect(node?.size).toEqual({ width: 204, height: 124 });
  });

  it('writes the position only to the current view when not the base view', () => {
    const { doc, editor } = setup();
    useUiStore.setState({ currentViewId: 'v2' });
    const session = startCardResize(editor, 'n1', 'top-left', 'component');
    if (session === null) throw new Error('no session');
    applyCardResize(editor, session, { x: -40, y: -20, width: 204, height: 124 }, noMods, 1);
    endCardResize(editor, session);
    const after = toJSON(doc);
    expect(after.nodes.find((n) => n.id === 'n1')?.position).toEqual({ x: 0, y: 0 });
    expect(after.views.find((v) => v.id === 'v2')?.positions?.n1).toEqual({ x: -40, y: -20 });
  });

  it('restores size and position and writes nothing on cancel', () => {
    const { doc, editor } = setup();
    const session = startCardResize(editor, 'n1', 'bottom-right', 'component');
    if (session === null) throw new Error('no session');
    applyCardResize(editor, session, { x: 0, y: 0, width: 240, height: 140 }, noMods, 1);
    editor.cancelGesture();
    session.cancelled = true;
    expect(toJSON(doc).nodes.find((n) => n.id === 'n1')?.size).toBeUndefined();
    expect(editor.undo()).toBe(false);
  });

  it('sets a resize readout during the gesture and clears it at the end', () => {
    const { editor } = setup();
    const session = startCardResize(editor, 'n1', 'bottom-right', 'component');
    if (session === null) throw new Error('no session');
    applyCardResize(editor, session, { x: 0, y: 0, width: 240, height: 140 }, noMods, 1);
    expect(useUiStore.getState().resizeReadout).toEqual({ width: 240, height: 140, x: 0, y: 0 });
    endCardResize(editor, session);
    expect(useUiStore.getState().resizeReadout).toBeNull();
  });

  it('announces the final size', () => {
    const { editor } = setup();
    const session = startCardResize(editor, 'n1', 'bottom-right', 'component');
    if (session === null) throw new Error('no session');
    applyCardResize(editor, session, { x: 0, y: 0, width: 244, height: 80 }, noMods, 1);
    endCardResize(editor, session);
    expect(useUiStore.getState().announcement.text).toBe('Resized API Gateway to 244 × 80');
  });
});

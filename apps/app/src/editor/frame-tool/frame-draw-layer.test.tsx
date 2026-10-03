import { toJSON } from '@sododeck/model';
import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { armFrameTool, placeFrameAtCentre } from './frame-actions';
import { FrameDrawLayer } from './frame-draw-layer';

/** As the canvas mounts it: only while the Frame tool is armed. */
function Layer() {
  const armed = useUiStore((s) => s.tool === 'frame');
  return armed ? <FrameDrawLayer /> : null;
}

const initialUi = useUiStore.getState();

const deck = () =>
  deckOf({
    nodes: [
      { id: 'a', type: 'service', title: 'A', position: { x: 120, y: 120 } },
      { id: 'b', type: 'pill', title: 'B', position: { x: 120, y: 260 } },
      { id: 'far', type: 'service', title: 'Far', position: { x: 900, y: 900 } },
    ],
  });

beforeEach(() => {
  useUiStore.setState(initialUi, true);
});

function drag(from: { x: number; y: number }, to: { x: number; y: number }) {
  const layer = screen.getByTestId('frame-draw-layer');
  fireEvent.pointerDown(layer, { clientX: from.x, clientY: from.y, pointerId: 1, button: 0 });
  fireEvent.pointerMove(layer, { clientX: to.x, clientY: to.y, pointerId: 1 });
  return layer;
}

describe('Frame tool drawing (031 US2)', () => {
  it('draws nothing until the tool is armed', () => {
    renderWithEditor(<Layer />, deck());
    expect(screen.queryByTestId('frame-draw-layer')).not.toBeInTheDocument();
    act(() => {
      armFrameTool();
    });
    expect(screen.getByTestId('frame-draw-layer')).toHaveClass('cursor-crosshair');
    expect(useUiStore.getState().tool).toBe('frame');
  });

  it('a drag previews a dashed rectangle with its size, and release makes one group', () => {
    const { doc } = renderWithEditor(<Layer />, deck());
    act(() => {
      armFrameTool();
    });
    const layer = drag({ x: 100, y: 100 }, { x: 500, y: 400 });
    expect(screen.getByTestId('frame-draw-preview')).toHaveClass('border-dashed');
    expect(screen.getByTestId('frame-draw-readout')).toHaveTextContent('400 × 300');
    fireEvent.pointerUp(layer, { clientX: 500, clientY: 400, pointerId: 1 });

    const after = toJSON(doc);
    expect(after.groups).toHaveLength(1);
    const [group] = after.groups;
    expect(group).toMatchObject({
      title: 'New group',
      position: { x: 100, y: 100 },
      size: { width: 400, height: 300 },
    });
    // The two cards fully inside join it; the far one does not.
    expect(after.nodes.filter((n) => n.group === group?.id).map((n) => n.id)).toEqual(['a', 'b']);
    const ui = useUiStore.getState();
    expect(ui.titleEdit).toMatchObject({ target: 'group', id: group?.id, isNew: true });
    expect(ui.announcement.text).toBe('Frame added, 2 items');
    expect(ui.tool).toBe('select');
    expect(screen.queryByTestId('frame-draw-layer')).not.toBeInTheDocument();
  });

  it('is one undo step that restores the cards’ groups', () => {
    const { doc, editor } = renderWithEditor(<Layer />, deck());
    act(() => {
      armFrameTool();
    });
    const layer = drag({ x: 100, y: 100 }, { x: 500, y: 400 });
    fireEvent.pointerUp(layer, { clientX: 500, clientY: 400, pointerId: 1 });
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).groups).toEqual([]);
    expect(toJSON(doc).nodes.every((n) => n.group === undefined)).toBe(true);
  });

  it('a click places a default 320 × 200 frame centred on it, empty', () => {
    const { doc } = renderWithEditor(<Layer />, deck());
    act(() => {
      armFrameTool();
    });
    const layer = screen.getByTestId('frame-draw-layer');
    fireEvent.pointerDown(layer, { clientX: 2000, clientY: 2000, pointerId: 1, button: 0 });
    fireEvent.pointerUp(layer, { clientX: 2001, clientY: 2000, pointerId: 1 });
    expect(toJSON(doc).groups[0]).toMatchObject({
      position: { x: 1840, y: 1900 },
      size: { width: 320, height: 200 },
    });
    expect(useUiStore.getState().announcement.text).toBe('Frame added, 0 items');
  });

  it('a small drag is clamped to the minimum frame', () => {
    const { doc } = renderWithEditor(<Layer />, deck());
    act(() => {
      armFrameTool();
    });
    const layer = drag({ x: 2000, y: 2000 }, { x: 2050, y: 2030 });
    fireEvent.pointerUp(layer, { clientX: 2050, clientY: 2030, pointerId: 1 });
    expect(toJSON(doc).groups[0]?.size).toEqual({ width: 160, height: 96 });
  });

  it('Esc (disarming the tool) drops a drag in progress and writes nothing', () => {
    const { doc } = renderWithEditor(<Layer />, deck());
    act(() => {
      armFrameTool();
    });
    drag({ x: 100, y: 100 }, { x: 500, y: 400 });
    act(() => {
      useUiStore.getState().setTool('select');
    });
    expect(screen.queryByTestId('frame-draw-preview')).not.toBeInTheDocument();
    expect(toJSON(doc).groups).toEqual([]);
  });

  it('⏎ on the tile places a default frame at the view centre', () => {
    const { doc, editor } = renderWithEditor(<Layer />, deck());
    act(() => {
      placeFrameAtCentre(editor(), { x: 0, y: 0 });
    });
    expect(toJSON(doc).groups[0]).toMatchObject({
      position: { x: -160, y: -100 },
      size: { width: 320, height: 200 },
    });
  });

  it('refuses in flow mode', () => {
    const { doc, editor } = renderWithEditor(<Layer />, deck());
    useUiStore.setState({
      activeFlow: { flowId: 'f', stepId: null, alternativeId: null, playing: false, speed: 1 },
    } as never);
    act(() => {
      armFrameTool();
      placeFrameAtCentre(editor(), { x: 0, y: 0 });
    });
    expect(useUiStore.getState().tool).toBe('select');
    expect(toJSON(doc).groups).toEqual([]);
  });
});

import { render, screen } from '@testing-library/react';
import { Position, ReactFlow, type ConnectionLineComponentProps, type Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { EndpointConnectionLine } from './endpoint-connection-line';

const props = (pointer: { x: number; y: number }): ConnectionLineComponentProps => ({
  connectionLineType: 'smoothstep' as ConnectionLineComponentProps['connectionLineType'],
  fromNode: { id: 'a' } as ConnectionLineComponentProps['fromNode'],
  fromHandle: {} as ConnectionLineComponentProps['fromHandle'],
  fromX: 164,
  fromY: 25,
  toX: pointer.x,
  toY: pointer.y,
  fromPosition: Position.Right,
  toPosition: Position.Left,
  connectionStatus: null,
  toNode: null,
  toHandle: null,
  pointer,
});

const nodeTypes = { deck: () => null, 'group-boundary': () => null };
const card = (id: string, x: number, y: number): Node => ({
  id,
  type: 'deck',
  position: { x, y },
  width: 164,
  height: 50,
  data: {},
});

/** The line renders inside a real canvas: it reads the drawn cards from React Flow's store. */
function renderLine(
  nodes: Node[],
  pointer: { x: number; y: number },
  viewport = { x: 0, y: 0, zoom: 1 },
) {
  return render(
    <ReactFlow nodes={nodes} edges={[]} nodeTypes={nodeTypes} defaultViewport={viewport}>
      <svg>
        <EndpointConnectionLine {...props(pointer)} />
      </svg>
    </ReactFlow>,
  );
}

const lastPoint = () => {
  const d = screen.getByTestId('endpoint-connection-line').getAttribute('d') ?? '';
  const numbers = d.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
  return { x: numbers.at(-2) ?? NaN, y: numbers.at(-1) ?? NaN };
};

describe('EndpointConnectionLine (050 R3: new connections)', () => {
  it('follows the pointer off every target', () => {
    renderLine([card('a', 0, 0)], { x: 300, y: 25 });
    // Right → Left, straight across, stopping one arrow length (9) short of the end.
    expect(screen.getByTestId('endpoint-connection-line')).toHaveAttribute(
      'd',
      'M164 25L184 25L227.5 25L227.5 25L271 25L291 25',
    );
    expect(screen.queryByTestId('endpoint-readout')).toBeNull();
  });

  it('attaches to the nearest outline point of the card under the pointer', () => {
    renderLine([card('a', 0, 0), card('b', 300, 0)], { x: 305, y: 35 });
    // B's left side at 70 %: (300, 35); the line stops an arrow short, coming from the left.
    expect(lastPoint()).toEqual({ x: 291, y: 35 });
    expect(screen.getByTestId('endpoint-readout')).toHaveTextContent('left side · 70 %');
  });

  it('attaches within 16 px outside a card too', () => {
    renderLine([card('a', 0, 0), card('b', 300, 0)], { x: 290, y: 25 });
    expect(lastPoint()).toEqual({ x: 291, y: 25 });
    expect(screen.getByTestId('endpoint-readout')).toHaveTextContent('left side · 50 % · snapped');
  });

  it('the card the connection starts from is not a target', () => {
    renderLine([card('a', 0, 0)], { x: 150, y: 40 });
    expect(screen.queryByTestId('endpoint-readout')).toBeNull();
  });

  it('attaches to a group frame the pointer is inside (050 US4)', () => {
    renderLine(
      [
        {
          id: 'group:g',
          type: 'group-boundary',
          position: { x: 250, y: -50 },
          width: 400,
          height: 300,
          data: {},
        },
      ],
      { x: 260, y: 100 },
    );
    // Nearest outline point: the frame's left side, at 50 % → snapped.
    expect(screen.getByTestId('endpoint-readout')).toHaveTextContent('left side · 50 % · snapped');
  });

  describe('on a panned and zoomed canvas', () => {
    // React Flow's `pointer` is in container px: flow point p sits at p * zoom + pan.
    const viewport = { x: 100, y: 50, zoom: 2 };
    const onScreen = (p: { x: number; y: number }) => ({
      x: p.x * viewport.zoom + viewport.x,
      y: p.y * viewport.zoom + viewport.y,
    });

    it('ends under the pointer off every target', () => {
      renderLine([card('a', 0, 0)], onScreen({ x: 300, y: 25 }), viewport);
      expect(screen.getByTestId('endpoint-connection-line')).toHaveAttribute(
        'd',
        'M164 25L184 25L227.5 25L227.5 25L271 25L291 25',
      );
    });

    it('attaches to the card under the pointer', () => {
      renderLine([card('a', 0, 0), card('b', 300, 0)], onScreen({ x: 305, y: 35 }), viewport);
      expect(lastPoint()).toEqual({ x: 291, y: 35 });
      expect(screen.getByTestId('endpoint-readout')).toHaveTextContent('left side · 70 %');
    });
  });
});

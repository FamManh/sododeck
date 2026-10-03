import { render, screen } from '@testing-library/react';
import { Position, type ConnectionLineComponentProps } from '@xyflow/react';
import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { EndpointConnectionLine } from './endpoint-connection-line';

const props: ConnectionLineComponentProps = {
  connectionLineType: 'smoothstep' as ConnectionLineComponentProps['connectionLineType'],
  fromNode: {} as ConnectionLineComponentProps['fromNode'],
  fromHandle: {} as ConnectionLineComponentProps['fromHandle'],
  fromX: 164,
  fromY: 25,
  toX: 300,
  toY: 25,
  fromPosition: Position.Right,
  toPosition: Position.Left,
  connectionStatus: null,
  toNode: null,
  toHandle: null,
  pointer: { x: 300, y: 25 },
};

describe('EndpointConnectionLine (017 R12)', () => {
  beforeEach(() => {
    useUiStore.getState().setEndpointHover(null);
  });

  it("routes through the fixed side and xyflow's nearest pointer side without a hover", () => {
    render(
      <svg>
        <EndpointConnectionLine {...props} />
      </svg>,
    );
    const path = screen.getByTestId('endpoint-connection-line');
    // Right → Left, straight across, stopping one arrow length (9) short of the end.
    expect(path).toHaveAttribute('d', 'M164 25L184 25L227.5 25L227.5 25L271 25L291 25');
  });

  it('routes to the hot side once a hover is recorded, even when it differs from toPosition', () => {
    act(() => {
      useUiStore.getState().setEndpointHover({ nodeId: 'b', side: 'top' });
    });
    render(
      <svg>
        <EndpointConnectionLine {...props} />
      </svg>,
    );
    const path = screen.getByTestId('endpoint-connection-line');
    expect(path).not.toHaveAttribute('d', 'M164 25L184 25L227.5 25L227.5 25L271 25L291 25');
  });
});

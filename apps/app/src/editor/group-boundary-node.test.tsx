import { render, screen } from '@testing-library/react';
import type { NodeProps } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import type { GroupFlowNode } from './deck-to-flow';
import { GroupBoundaryNode } from './group-boundary-node';

describe('GroupBoundaryNode', () => {
  it('labels the boundary with the group title and member count', () => {
    const props = {
      id: 'group:core',
      data: { title: 'Core services', count: 8 },
      width: 300,
      height: 200,
    } as unknown as NodeProps<GroupFlowNode>;
    render(<GroupBoundaryNode {...props} />);
    const boundary = screen.getByTestId('group-boundary');
    expect(boundary).toHaveTextContent('Core services8');
    expect(screen.getByText('Core services')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });
});

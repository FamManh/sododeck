import { render, screen } from '@testing-library/react';
import type { NodeProps } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import type { ScopeLabelFlowNode } from './deck-to-flow';
import { ScopeLabelNode } from './scope-label-node';

function draw(title = 'Core services', count = 7) {
  const props = {
    id: 'scope-label:core',
    data: { title, count },
  } as unknown as NodeProps<ScopeLabelFlowNode>;
  return render(<ScopeLabelNode {...props} />);
}

describe('ScopeLabelNode (034 US3)', () => {
  it('shows "Inside <name>" and the count', () => {
    const { container } = draw();
    expect(container).toHaveTextContent('Inside Core services');
    expect(container).toHaveTextContent('7');
  });

  it('is decorative: hidden from assistive tech and not focusable', () => {
    const { container } = draw();
    const root = container.firstElementChild;
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('[tabindex]')).toBeNull();
    expect(root?.getAttribute('class')).toContain('pointer-events-none');
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CanvasShell } from './canvas-shell';

describe('CanvasShell', () => {
  it('keeps the same full-bleed canvas box whatever chrome is shown (FR-002)', () => {
    const canvas = <div aria-label="Diagram canvas" />;
    const { rerender } = render(<CanvasShell canvas={canvas} />);
    const box = screen.getByTestId('shell-canvas');
    expect(box).toHaveClass('absolute', 'inset-0');
    expect(box).toContainElement(screen.getByLabelText('Diagram canvas'));

    rerender(
      <CanvasShell canvas={canvas}>
        <aside aria-label="Details" className="pointer-events-auto absolute right-3" />
      </CanvasShell>,
    );
    // Same element, same classes: the canvas neither re-mounts nor changes size.
    expect(screen.getByTestId('shell-canvas')).toBe(box);
    expect(box).toHaveClass('absolute', 'inset-0');
    expect(screen.getByRole('complementary', { name: 'Details' })).toBeInTheDocument();
  });

  it('lets pointer events through the chrome layer except on the chrome itself (FR-004)', () => {
    render(
      <CanvasShell canvas={<div />}>
        <div role="toolbar" aria-label="Zoom" className="pointer-events-auto" />
      </CanvasShell>,
    );
    expect(screen.getByTestId('shell-overlay')).toHaveClass('pointer-events-none');
    expect(screen.getByRole('toolbar', { name: 'Zoom' })).toHaveClass('pointer-events-auto');
  });
});

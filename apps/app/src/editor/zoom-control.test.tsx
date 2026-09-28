import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type * as XYFlow from '@xyflow/react';
import { renderWithEditor } from '../test/render-canvas';
import { ZoomControl } from './zoom-control';

const viewport = vi.hoisted(() => ({ zoom: 1 }));

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof XYFlow>();
  return { ...actual, useViewport: () => ({ x: 0, y: 0, zoom: viewport.zoom }) };
});

describe('ZoomControl', () => {
  it('shows the zoom and names its buttons', () => {
    viewport.zoom = 0.7;
    renderWithEditor(<ZoomControl level="system" scope={{ node: null, group: null }} />);
    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Fit diagram' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Level: System' })).toBeInTheDocument();
  });

  it('disables Zoom out at 30% and Zoom in at 200%', () => {
    viewport.zoom = 0.3;
    const { unmount } = renderWithEditor(
      <ZoomControl level="landscape" scope={{ node: null, group: null }} />,
    );
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
    unmount();
    viewport.zoom = 2;
    renderWithEditor(<ZoomControl level="component" scope={{ node: null, group: null }} />);
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
    expect(screen.getByText('200%')).toBeInTheDocument();
  });
});

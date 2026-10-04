import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { EmptyCanvasCard } from './empty-canvas-card';

describe('EmptyCanvasCard', () => {
  it('offers Import SQL or DBML only when asked (Database pack on, 044)', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<EmptyCanvasCard />);
    expect(screen.queryByRole('button', { name: 'Import SQL or DBML' })).not.toBeInTheDocument();
    rerender(<EmptyCanvasCard showImport />);
    await user.click(screen.getByRole('button', { name: 'Import SQL or DBML' }));
    expect(useUiStore.getState().importDialog.open).toBe(true);
  });
});

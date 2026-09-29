import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { renderWithEditor } from '../../test/render-canvas';
import { ShortcutHelpDialog } from './shortcut-help-dialog';
import { SHORTCUTS, shortcutLabel } from './shortcuts';

describe('ShortcutHelpDialog (018 FR-039, 016 T061)', () => {
  it('lists every shortcut of the table, the 016 Editing section included', () => {
    renderWithEditor(<ShortcutHelpDialog />);
    act(() => {
      useUiStore.getState().setHelpOpen(true);
    });
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    const editing = within(dialog).getByRole('table', { name: 'Editing' });
    const rows = within(editing).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual(
      SHORTCUTS.filter((s) => s.section === 'Editing').map(
        (s) => `${s.label}${shortcutLabel(s.id)}`,
      ),
    );
    expect(within(dialog).getAllByRole('row')).toHaveLength(
      SHORTCUTS.length + within(dialog).getAllByRole('table').length,
    );
    expect(within(dialog).getByText(shortcutLabel('group'))).toBeInTheDocument();
  });
});

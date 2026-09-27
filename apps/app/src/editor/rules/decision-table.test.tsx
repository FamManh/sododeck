import { toJSON } from '@sododeck/model';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderRules } from '../../test/render-rules';
import { ruleDeck } from '../../test/rule-fixtures';

const setup = () => renderRules(ruleDeck, '/deck/d/rules/T');
const rule = (doc: Parameters<typeof toJSON>[0]) => toJSON(doc).rules.T;
const grid = () => screen.getByRole('grid', { name: 'Decision table Delivery tier' });
const cell = (column: string, row: number) =>
  within(grid()).getByRole('gridcell', {
    name: (name) => name.startsWith(`${column}, row ${String(row)}:`),
  });

describe('DecisionTable (story 4, FR-021–FR-023)', () => {
  it('adds a condition (rows get Any) and an action (rows get empty), each named at once', async () => {
    const { user, doc } = setup();
    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    const name = screen.getByRole('textbox', { name: 'Column name' });
    expect(name).toHaveFocus();
    await user.clear(name);
    await user.keyboard('Zone{Enter}');
    expect(rule(doc)?.inputs.at(-1)?.label).toBe('Zone');
    expect(rule(doc)?.rows.every((r) => r.when.at(-1) === '')).toBe(true);
    expect(cell('Zone', 1)).toHaveTextContent('Any');
    await user.click(screen.getByRole('button', { name: 'Add action' }));
    await user.keyboard('{Enter}');
    expect(rule(doc)?.outputs.at(-1)?.label).toBe('Action 4');
    expect(rule(doc)?.rows.every((r) => r.then.at(-1) === '')).toBe(true);
  });

  it('renames a column from its menu, refusing an empty name', async () => {
    const { user, doc } = setup();
    await user.click(screen.getByRole('button', { name: 'Column options for Priority' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    const name = await screen.findByRole('textbox', { name: 'Column name' });
    await user.clear(name);
    await user.keyboard('{Enter}');
    expect(screen.getByText('Column name can’t be empty.')).toBeInTheDocument();
    await user.type(name, 'Service level{Enter}');
    expect(rule(doc)?.inputs[2]?.label).toBe('Service level');
    expect(
      within(grid()).getByRole('columnheader', { name: 'Condition Service level' }),
    ).toBeInTheDocument();
  });

  it('removes a condition column without a dialog; ⌘Z restores it and the step inputs', async () => {
    const { user, doc } = setup();
    await user.click(screen.getByRole('button', { name: 'Column options for Priority' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(rule(doc)?.inputs.map((c) => c.id)).toEqual(['dist', 'weight']);
    expect(toJSON(doc).flows[0]?.steps[1]?.ruleInputs).toEqual({ T: { dist: '5', weight: '10' } });
    expect(
      screen.getByText(/Column “Priority” deleted · (⌘Z|Ctrl\+Z) to undo/),
    ).toBeInTheDocument();
    cell('Vehicle', 1).focus();
    await user.keyboard('{Control>}z{/Control}');
    expect(rule(doc)?.inputs.map((c) => c.id)).toEqual(['dist', 'weight', 'prio']);
    expect(toJSON(doc).flows[0]?.steps[1]?.ruleInputs).toEqual({
      T: { dist: '5', weight: '10', prio: 'Express' },
    });
  });

  it('accepts every cell syntax and marks an invalid condition', async () => {
    const { user, doc } = setup();
    const inputs = ['<= 5', '> 20', 'Bike, Van', 'Any', '', 'Express', '≤ 5'];
    for (const value of inputs) {
      cell('Priority', 1).focus();
      await user.keyboard('{Enter}');
      const editor = screen.getByRole('textbox', { name: 'Edit Priority, row 1' });
      await user.clear(editor);
      if (value !== '') await user.type(editor, value);
      await user.keyboard('{Enter}');
      expect(rule(doc)?.rows[0]?.when[2]).toBe(value);
      expect(cell('Priority', 1)).not.toHaveAttribute('aria-invalid');
    }
    cell('Distance (km)', 2).focus();
    await user.keyboard('{Enter}');
    const editor = screen.getByRole('textbox', { name: 'Edit Distance (km), row 2' });
    await user.clear(editor);
    await user.type(editor, '> abc{Enter}');
    const bad = cell('Distance (km)', 2);
    expect(bad).toHaveAttribute('aria-invalid', 'true');
    expect(bad).toHaveAccessibleDescription('Not a valid condition');
  });

  it('moves with the arrows, edits with F2 or typing, and cancels with Esc', async () => {
    const { user, doc } = setup();
    cell('Distance (km)', 1).focus();
    await user.keyboard('{ArrowRight}{ArrowDown}');
    expect(cell('Weight (kg)', 2)).toHaveFocus();
    await user.keyboard('{F2}');
    const editor = screen.getByRole('textbox', { name: 'Edit Weight (kg), row 2' });
    expect(editor).toHaveValue('≤ 10');
    await user.keyboard('0{Escape}');
    expect(rule(doc)?.rows[1]?.when[1]).toBe('≤ 10');
    expect(cell('Weight (kg)', 2)).toHaveFocus();
    await user.keyboard('7');
    const typed = screen.getByRole('textbox', { name: 'Edit Weight (kg), row 2' });
    expect(typed).toHaveValue('7');
    await user.keyboard('{Enter}');
    expect(rule(doc)?.rows[1]?.when[1]).toBe('7');
    expect(cell('Weight (kg)', 3)).toHaveFocus();
  });

  it('adds a row of Any and empty cells at the end', async () => {
    const { user, doc } = setup();
    await user.click(screen.getByRole('button', { name: 'Add row' }));
    expect(rule(doc)?.rows).toHaveLength(6);
    expect(rule(doc)?.rows[5]).toMatchObject({ when: ['', '', ''], then: ['', '', ''] });
    expect(within(grid()).getAllByRole('row')).toHaveLength(8);
  });

  it('moves a row with ⌥↓ / ⌥↑ and deletes one with ⌫ on its header, with an Undo toast', async () => {
    const { user, doc, ui } = setup();
    cell('Vehicle', 1).focus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(rule(doc)?.rows.map((r) => r.id)).toEqual(['r2', 'r1', 'r3', 'r4', 'r5']);
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(rule(doc)?.rows.map((r) => r.id)).toEqual(['r1', 'r2', 'r3', 'r4', 'r5']);
    within(grid()).getByRole('rowheader', { name: 'Row 3' }).focus();
    await user.keyboard('{Backspace}');
    expect(rule(doc)?.rows.map((r) => r.id)).toEqual(['r1', 'r2', 'r4', 'r5']);
    expect(ui().announcement.text).toBe('Row 3 deleted');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(rule(doc)?.rows.map((r) => r.id)).toEqual(['r1', 'r2', 'r3', 'r4', 'r5']);
    await user.click(within(grid()).getByRole('button', { name: 'Delete row 5' }));
    expect(rule(doc)?.rows).toHaveLength(4);
  });
});

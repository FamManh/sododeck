import { findField, type ResolvedField } from '@sododeck/model';
import { emptySododeckFile, type FieldDef } from '@sododeck/schema';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ValueControl } from './value-control';

const resolved = (def: FieldDef): ResolvedField => ({ ...def, source: 'deck' });

function setup(def: FieldDef, value?: unknown, people?: readonly string[]) {
  const onCommit = vi.fn();
  render(
    <div>
      <span id="name">{def.name}</span>
      <ValueControl
        field={resolved(def)}
        labelId="name"
        value={value}
        onCommit={onCommit}
        people={people}
      />
      <button type="button">elsewhere</button>
    </div>,
  );
  return { onCommit, user: userEvent.setup() };
}

describe('value controls (032 US1 AS3–AS5)', () => {
  it('text: a textbox committing on Enter; empty clears', async () => {
    const { onCommit, user } = setup({ id: 'f', name: 'Notes', kind: 'text' }, 'old');
    const box = screen.getByRole('textbox', { name: 'Notes' });
    await user.clear(box);
    await user.type(box, 'Bay 4{Enter}');
    expect(onCommit).toHaveBeenLastCalledWith('Bay 4');
    await user.clear(box);
    await user.tab();
    expect(onCommit).toHaveBeenLastCalledWith(null);
  });

  it('number: a spinbutton with the unit; letters are refused with a message', async () => {
    const { onCommit, user } = setup({ id: 'f', name: 'SLA', kind: 'number', unit: 'h' });
    const box = screen.getByRole('spinbutton', { name: 'SLA h' });
    await user.type(box, 'abc{Enter}');
    expect(screen.getByText('Enter a number.')).toBeInTheDocument();
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(onCommit).not.toHaveBeenCalled();
    await user.clear(box);
    await user.type(box, '24{Enter}');
    expect(onCommit).toHaveBeenLastCalledWith(24);
    expect(screen.queryByText('Enter a number.')).not.toBeInTheDocument();
  });

  it('select: a combobox of the options with search; picking writes the option id', async () => {
    const field: FieldDef = {
      id: 'f',
      name: 'Region',
      kind: 'select',
      options: [
        { id: 'n', label: 'North' },
        { id: 's', label: 'South', color: 'amber' },
      ],
    };
    const { onCommit, user } = setup(field);
    const box = screen.getByRole('combobox', { name: 'Region' });
    await user.type(box, 'sou');
    const list = screen.getByRole('listbox', { name: 'Region options' });
    expect(
      within(list)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['South']);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onCommit).toHaveBeenLastCalledWith('s');
  });

  it('status: options show their status icons, and None clears a value', async () => {
    const status = findField(emptySododeckFile(), 'task.status');
    if (status === undefined) throw new Error('missing default');
    const { onCommit, user } = setup(status, 'doing');
    const box = screen.getByRole('combobox', { name: 'Status' });
    expect(box).toHaveValue('In progress');
    await user.click(box);
    const options = within(screen.getByRole('listbox', { name: 'Status options' })).getAllByRole(
      'option',
    );
    expect(options.map((o) => o.textContent)).toEqual(['To do', 'In progress', 'Done', 'None']);
    expect(options[0]?.querySelector('svg')).not.toBeNull();
    await user.click(screen.getByRole('option', { name: 'None' }));
    expect(onCommit).toHaveBeenLastCalledWith(null);
  });

  it('person: suggests deck names and commits the typed name', async () => {
    const { onCommit, user } = setup({ id: 'f', name: 'Assignee', kind: 'person' }, undefined, [
      'Lan',
      'Minh Tran',
    ]);
    const box = screen.getByRole('combobox', { name: 'Assignee' });
    await user.type(box, 'mi');
    await user.click(
      within(screen.getByRole('listbox', { name: 'Assignee suggestions' })).getByRole('option', {
        name: 'Minh Tran',
      }),
    );
    expect(onCommit).toHaveBeenLastCalledWith('Minh Tran');
    await user.clear(box);
    await user.type(box, ' lan {Enter}');
    expect(onCommit).toHaveBeenLastCalledWith('lan');
  });

  it('date: a date input writing YYYY-MM-DD', async () => {
    const { onCommit, user } = setup({ id: 'f', name: 'Due date', kind: 'date' });
    await user.type(screen.getByLabelText('Due date'), '2026-10-14');
    expect(onCommit).toHaveBeenLastCalledWith('2026-10-14');
  });

  it('date range: From and To; an end before the start is refused', async () => {
    const { onCommit, user } = setup({ id: 'f', name: 'Dates', kind: 'dateRange' });
    const group = screen.getByRole('group', { name: 'Dates' });
    await user.type(within(group).getByLabelText('From'), '2026-10-17');
    await user.type(within(group).getByLabelText('To'), '2026-10-06');
    expect(screen.getByText('The end is before the start.')).toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();
    await user.clear(within(group).getByLabelText('To'));
    await user.type(within(group).getByLabelText('To'), '2026-10-20');
    expect(onCommit).toHaveBeenLastCalledWith({ from: '2026-10-17', to: '2026-10-20' });
  });

  it('link: URL and Label; a non web or mail address is refused', async () => {
    const { onCommit, user } = setup({ id: 'f', name: 'Runbook', kind: 'link' });
    const group = screen.getByRole('group', { name: 'Runbook' });
    const url = within(group).getByRole('textbox', { name: 'URL' });
    await user.type(url, 'ftp:x{Enter}');
    expect(
      screen.getByText('Enter a web (http, https) or mail (mailto) address.'),
    ).toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();
    await user.clear(url);
    await user.type(url, 'https://wiki.example.com/hub');
    await user.type(within(group).getByRole('textbox', { name: 'Label' }), 'Hub{Enter}');
    expect(onCommit).toHaveBeenLastCalledWith({
      url: 'https://wiki.example.com/hub',
      label: 'Hub',
    });
  });

  it('progress: a 0–100 slider and a number; 140 is refused', async () => {
    const { onCommit, user } = setup({ id: 'f', name: 'Capacity', kind: 'progress' }, 40);
    const slider = screen.getByRole('slider', { name: 'Capacity' });
    expect(slider).toHaveValue('40');
    // jsdom does not move a range input on arrow keys; the browser fires the same change.
    fireEvent.change(slider, { target: { value: '41' } });
    fireEvent.keyUp(slider, { key: 'ArrowRight' });
    expect(onCommit).toHaveBeenLastCalledWith(41);
    const box = screen.getByRole('spinbutton', { name: 'Capacity percent' });
    await user.clear(box);
    await user.type(box, '140{Enter}');
    expect(screen.getByText('Enter a number from 0 to 100.')).toBeInTheDocument();
    await user.clear(box);
    await user.type(box, '82{Enter}');
    expect(onCommit).toHaveBeenLastCalledWith(82);
  });
});

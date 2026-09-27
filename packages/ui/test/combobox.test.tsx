import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Combobox, type ComboboxOption } from '../src/components/combobox';
import { focusRing } from '../src/lib/focus';

const OWNERS = ['Orders', 'Payments', 'Dispatch', 'Core', 'Platform', 'Store', 'Mobile', 'Web'];

function Free({ spy, initial = '' }: { spy?: (v: string) => void; initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <Combobox
        mode="free"
        label="Owner"
        listLabel="Owner suggestions"
        placeholder="Add owner"
        value={value}
        onValueChange={(next) => {
          spy?.(next);
          setValue(next);
        }}
        options={OWNERS}
      />
      <button type="button">After</button>
    </>
  );
}

const KINDS: ComboboxOption[] = [
  { value: 'client', label: 'Client' },
  { value: 'service', label: 'Service' },
  { value: 'database', label: 'Database' },
];

function Pick({ spy, initial = 'service' }: { spy?: (v: string) => void; initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <Combobox
        mode="pick"
        label="Kind"
        listLabel="Kinds"
        value={value}
        onValueChange={(next) => {
          spy?.(next);
          setValue(next);
        }}
        options={KINDS}
      />
      <button type="button">After</button>
    </>
  );
}

const listbox = () => screen.getByRole('listbox');

describe('Combobox (free mode)', () => {
  it('is a combobox with list autocomplete, a placeholder and the focus ring', () => {
    render(<Free />);
    const box = screen.getByRole('combobox', { name: 'Owner' });
    expect(box).toHaveAttribute('aria-autocomplete', 'list');
    expect(box).toHaveAttribute('aria-expanded', 'false');
    expect(box).toHaveAttribute('placeholder', 'Add owner');
    expect(box).toHaveClass(...focusRing.split(' '));
  });

  it('suggests options containing the typed text, ignoring case', async () => {
    const user = userEvent.setup();
    render(<Free />);
    await user.type(screen.getByRole('combobox', { name: 'Owner' }), 'or');
    expect(screen.getByRole('listbox', { name: 'Owner suggestions' })).toBeInTheDocument();
    const names = within(listbox())
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(names).toEqual(['Orders', 'Core', 'Platform', 'Store']);
    expect(screen.getByRole('combobox', { name: 'Owner' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('shows at most 8 options', async () => {
    const user = userEvent.setup();
    function Many() {
      const [value, setValue] = useState('');
      return (
        <Combobox
          mode="free"
          label="Owner"
          listLabel="Owner suggestions"
          value={value}
          onValueChange={setValue}
          options={Array.from({ length: 20 }, (_, i) => `Team ${String(i)}`)}
        />
      );
    }
    render(<Many />);
    await user.type(screen.getByRole('combobox'), 'team');
    expect(within(listbox()).getAllByRole('option')).toHaveLength(8);
  });

  it('moves with the arrows and chooses with Enter', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Free spy={spy} />);
    const box = screen.getByRole('combobox', { name: 'Owner' });
    await user.type(box, 'or');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    const active = screen.getByRole('option', { name: 'Core' });
    expect(box).toHaveAttribute('aria-activedescendant', active.id);
    expect(active).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}{Enter}');
    expect(box).toHaveValue('Orders');
    expect(spy).toHaveBeenLastCalledWith('Orders');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('accepts new free text as is', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Free spy={spy} />);
    await user.type(screen.getByRole('combobox'), 'Platform team{Enter}');
    expect(spy).toHaveBeenLastCalledWith('Platform team');
    expect(screen.getByRole('combobox')).toHaveValue('Platform team');
  });

  it('chooses an option with the mouse', async () => {
    const user = userEvent.setup();
    render(<Free />);
    await user.type(screen.getByRole('combobox'), 'pay');
    await user.click(screen.getByRole('option', { name: 'Payments' }));
    expect(screen.getByRole('combobox')).toHaveValue('Payments');
  });

  it('closes on Esc without propagating, and passes Esc on when closed', async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    function WithKeys() {
      const [value, setValue] = useState('');
      return (
        <Combobox
          mode="free"
          label="Owner"
          listLabel="Owner suggestions"
          value={value}
          onValueChange={setValue}
          options={OWNERS}
          onKeyDown={(e) => {
            onKeyDown(e.key);
          }}
        />
      );
    }
    render(<WithKeys />);
    await user.type(screen.getByRole('combobox'), 'or');
    onKeyDown.mockClear();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onKeyDown).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(onKeyDown).toHaveBeenCalledWith('Escape');
  });

  it('opens with ArrowDown and shows every option when nothing was typed', async () => {
    const user = userEvent.setup();
    render(<Free initial="Orders" />);
    screen.getByRole('combobox').focus();
    await user.keyboard('{ArrowDown}');
    expect(within(listbox()).getAllByRole('option')).toHaveLength(8);
  });

  it('passes aria-describedby through (used for "Mixed")', () => {
    render(
      <>
        <span id="mixed">Mixed values</span>
        <Combobox
          mode="free"
          label="Owner"
          listLabel="Owner suggestions"
          value=""
          onValueChange={() => undefined}
          options={[]}
          placeholder="Mixed"
          aria-describedby="mixed"
        />
      </>,
    );
    expect(screen.getByRole('combobox')).toHaveAccessibleDescription('Mixed values');
  });
});

describe('Combobox (pick mode)', () => {
  it('shows the label of the selected value', () => {
    render(<Pick />);
    expect(screen.getByRole('combobox', { name: 'Kind' })).toHaveValue('Service');
  });

  it('filters and picks an option with the keyboard', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Pick spy={spy} />);
    const box = screen.getByRole('combobox', { name: 'Kind' });
    await user.clear(box);
    await user.type(box, 'data');
    expect(
      within(listbox())
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Database']);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(spy).toHaveBeenCalledExactlyOnceWith('database');
    expect(box).toHaveValue('Database');
  });

  it('rejects free text: nothing changes and the label comes back on blur', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Pick spy={spy} />);
    const box = screen.getByRole('combobox', { name: 'Kind' });
    await user.clear(box);
    await user.type(box, 'Mainframe{Enter}');
    expect(spy).not.toHaveBeenCalled();
    await user.tab();
    expect(box).toHaveValue('Service');
  });

  it('marks the selected option with a check', async () => {
    const user = userEvent.setup();
    render(<Pick />);
    screen.getByRole('combobox').focus();
    await user.keyboard('{ArrowDown}');
    const selected = screen.getByRole('option', { name: 'Service' });
    expect(selected.querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('option', { name: 'Client' }).querySelector('svg')).toBeNull();
  });
});

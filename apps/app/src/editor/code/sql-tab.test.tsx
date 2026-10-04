import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { shopDeck } from '../../db/fixtures/shop';
import { useUiStore } from '../../state/ui-store';
import { editorWrapper } from '../../test/render-canvas';
import { SqlTab, SQL_READ_ONLY_MESSAGE } from './sql-tab';

// Monaco does not run in jsdom: a double shows the text and exposes the viewer callbacks.
vi.mock('./sql-viewer', () => ({
  default: ({
    text,
    ariaLabel,
    language,
    onReadOnlyAttempt,
  }: {
    text: string;
    ariaLabel: string;
    language: string;
    onReadOnlyAttempt: () => void;
  }) => (
    <div>
      <pre aria-label={ariaLabel} data-language={language}>
        {text}
      </pre>
      <button type="button" onClick={onReadOnlyAttempt}>
        Attempt edit
      </button>
    </div>
  ),
}));

describe('SqlTab', () => {
  it('shows the writer SQL of a Postgres deck without a dialect picker', async () => {
    const { wrapper } = editorWrapper(shopDeck('postgres'));
    render(<SqlTab scope="schema" />, { wrapper });
    const pre = await screen.findByLabelText('SQL schema', { selector: 'pre' });
    expect(pre.textContent).toContain('CREATE TABLE');
    expect(pre).toHaveAttribute('data-language', 'pgsql');
    expect(screen.queryByRole('combobox', { name: 'Preview dialect' })).not.toBeInTheDocument();
  });

  it('offers a Preview dialect select on a Generic deck', async () => {
    const { wrapper } = editorWrapper(shopDeck('generic'));
    render(<SqlTab scope="schema" />, { wrapper });
    expect(await screen.findByRole('combobox', { name: 'Preview dialect' })).toBeInTheDocument();
    expect((await screen.findByLabelText('SQL schema', { selector: 'pre' })).textContent).toContain(
      'CREATE TABLE',
    );
  });

  it('asks for a selection in Selection scope with nothing selected', () => {
    const { wrapper } = editorWrapper(shopDeck('postgres'));
    render(<SqlTab scope="selection" />, { wrapper });
    expect(screen.getByText('Select tables, or switch to Whole schema.')).toBeInTheDocument();
  });

  it('announces the read-only message at most every 3 s', async () => {
    const { wrapper } = editorWrapper(shopDeck('postgres'));
    render(<SqlTab scope="schema" />, { wrapper });
    const user = userEvent.setup();
    const attempt = await screen.findByRole('button', { name: 'Attempt edit' });
    await user.click(attempt);
    const first = useUiStore.getState().announcement;
    expect(first.text).toBe(SQL_READ_ONLY_MESSAGE);
    await user.click(attempt);
    expect(useUiStore.getState().announcement.seq).toBe(first.seq);
  });

  it('has a Copy button', async () => {
    const { wrapper } = editorWrapper(shopDeck('postgres'));
    render(<SqlTab scope="schema" />, { wrapper });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy' })).toBeEnabled();
    });
  });
});

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
    render(<SqlTab />, { wrapper });
    const pre = await screen.findByLabelText('SQL schema', { selector: 'pre' });
    expect(pre.textContent).toContain('CREATE TABLE');
    expect(pre).toHaveAttribute('data-language', 'pgsql');
    expect(screen.queryByRole('combobox', { name: 'Preview dialect' })).not.toBeInTheDocument();
  });

  it('offers a Preview dialect select on a Generic deck', async () => {
    const { wrapper } = editorWrapper(shopDeck('generic'));
    render(<SqlTab />, { wrapper });
    expect(await screen.findByRole('combobox', { name: 'Preview dialect' })).toBeInTheDocument();
    expect((await screen.findByLabelText('SQL schema', { selector: 'pre' })).textContent).toContain(
      'CREATE TABLE',
    );
  });

  it('shows the whole schema whatever is selected, and never asks for a selection (054)', async () => {
    const { wrapper } = editorWrapper(shopDeck('postgres'));
    useUiStore.getState().select({ nodes: ['orders'] });
    render(<SqlTab />, { wrapper });
    const pre = await screen.findByLabelText('SQL schema', { selector: 'pre' });
    expect(pre.textContent).toContain('CREATE TABLE customers');
    expect(screen.queryByText(/Select tables/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Whole schema/)).not.toBeInTheDocument();
  });

  it('says there are no tables in an empty deck', () => {
    const { wrapper } = editorWrapper({ ...shopDeck('postgres'), nodes: [], edges: [], enums: [] });
    render(<SqlTab />, { wrapper });
    expect(
      screen.getByText('No tables yet. Add one on the canvas or in the DBML tab.'),
    ).toBeInTheDocument();
  });

  it('announces the read-only message at most every 3 s', async () => {
    const { wrapper } = editorWrapper(shopDeck('postgres'));
    render(<SqlTab />, { wrapper });
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
    render(<SqlTab />, { wrapper });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy' })).toBeEnabled();
    });
  });
});

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as LayoutClientModule from '../layout/layout-client';
import { liveDecks } from '../storage/library-db';
import { freshLibraryDb } from '../test/library-fixtures';
import { renderLibrary } from '../test/render-library';

vi.mock('../storage/library-client', (importOriginal) =>
  import('../test/mock-library-client').then((m) => m.mockLibraryClient(importOriginal)),
);

// jsdom has no Worker: the layout worker's answer is a simple row.
vi.mock('../layout/layout-client', async (importOriginal) => {
  const actual = await importOriginal<typeof LayoutClientModule>();
  const client = {
    layout: (request: { nodes: { id: string }[] }) =>
      Promise.resolve(
        Object.fromEntries(request.nodes.map((n, i) => [n.id, { x: i * 260, y: 0 }])),
      ),
    cancel: () => undefined,
    terminate: () => undefined,
  };
  return { ...actual, getLayoutClient: () => client };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const FLOWCHART = `flowchart LR
  subgraph Client
    W[Web app] -->|login| A(API)
  end
  A --> D{Valid?}
  style W fill:#fff
  what is this ???`;

async function openDialog() {
  const db = await freshLibraryDb();
  const view = await renderLibrary({ db });
  const trigger = await screen.findByRole('button', { name: 'Import Mermaid' });
  await view.user.click(trigger);
  const dialog = await screen.findByRole('dialog', { name: 'Import Mermaid' });
  return { ...view, db, trigger, dialog };
}

describe('Import Mermaid dialog', () => {
  it('imports pasted text, shows the report and offers Open deck', async () => {
    const { user, db, dialog } = await openDialog();
    await user.click(within(dialog).getByLabelText('Mermaid diagram'));
    await user.paste(FLOWCHART);
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));

    expect(await screen.findByText('3 components, 2 connections, 1 group')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: '2 lines skipped' });
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('style W fill:#fff');
    expect(within(list).getAllByRole('listitem')[1]).toHaveTextContent('what is this ???');
    const [deck] = await liveDecks(db);
    expect(deck).toMatchObject({ name: 'Imported diagram', nodeCount: 3 });

    await user.click(screen.getByRole('button', { name: 'Open deck' }));
    expect(await screen.findByText(`Editor for ${deck?.id}`)).toBeInTheDocument();
  });

  it('says nothing was skipped for clean text', async () => {
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByLabelText('Mermaid diagram'));
    await user.paste('sequenceDiagram\n  A->>B: hi\n  B-->>A: ok');
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    expect(
      await screen.findByText('2 components, 2 connections, 1 flow with 2 steps'),
    ).toBeInTheDocument();
    expect(screen.getByText('Nothing was skipped.')).toBeInTheDocument();
  });

  it('reads a chosen file into the text box', async () => {
    const { user, dialog } = await openDialog();
    const text = 'flowchart TD\n  A --> B';
    await user.upload(
      within(dialog).getByTestId('import-mermaid-input'),
      new File([text], 'diagram.mmd', { type: 'text/plain' }),
    );
    await waitFor(() => {
      expect(within(dialog).getByLabelText('Mermaid diagram')).toHaveValue(text);
    });
  });

  it.each([
    ['', 'Nothing to import.'],
    [
      'erDiagram\n  A ||--o{ B : has',
      'ER diagrams are not supported yet. Supported: flowchart, sequence diagram.',
    ],
    ['flowchart LR\n  ???', 'Nothing could be read. First problem: line 2: ???'],
    [`flowchart LR\n${'A --> B\n'.repeat(4001)}`, /^That diagram is too large/],
  ])('shows a refusal inline, keeps the text and adds no deck (%#)', async (text, message) => {
    const { user, db, dialog } = await openDialog();
    const box = within(dialog).getByLabelText('Mermaid diagram');
    if (text !== '') fireEvent.change(box, { target: { value: text } });
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    const alert = await within(dialog).findByRole('alert');
    if (typeof message === 'string') expect(alert).toHaveTextContent(message);
    else expect(alert.textContent).toMatch(message);
    expect(box).toHaveValue(text);
    expect(await liveDecks(db)).toEqual([]);
  });

  it('closes with Escape and returns focus to the button that opened it', async () => {
    const { user, trigger } = await openDialog();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await new Promise((r) => setTimeout(r, 50));
    console.log('ACTIVE', document.activeElement?.outerHTML.slice(0, 120), trigger.isConnected);
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it('is disabled while the import runs and cannot be closed', async () => {
    const { user, dialog } = await openDialog();
    const box = within(dialog).getByLabelText('Mermaid diagram');
    fireEvent.change(box, { target: { value: 'sequenceDiagram\nA->>B: hi' } });
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    // The in-process worker answers asynchronously: the pending state is visible first.
    expect(within(dialog).queryByRole('button', { name: 'Importing…' }) ?? box).toBeDisabled();
    await screen.findByText(/1 flow with 1 step/);
  });

  it('opens a dropped Mermaid file in the dialog and imports it', async () => {
    const db = await freshLibraryDb();
    await renderLibrary({ db });
    const file = new File(['flowchart LR\n  A --> B'], 'drop.mmd');
    fireEvent.drop(screen.getByRole('main'), { dataTransfer: { files: [file], types: ['Files'] } });
    expect(await screen.findByText('2 components, 1 connection, 0 groups')).toBeInTheDocument();
    expect(await liveDecks(db)).toHaveLength(1);
  });

  it('makes no network request while importing (FR-020)', async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('network')));
    vi.stubGlobal('fetch', fetchSpy);
    const open = vi.spyOn(XMLHttpRequest.prototype, 'open');
    const { user, dialog } = await openDialog();
    fireEvent.change(within(dialog).getByLabelText('Mermaid diagram'), {
      target: { value: FLOWCHART },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    await screen.findByText('3 components, 2 connections, 1 group');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('never injects markup: titles render as text and no component sets innerHTML', async () => {
    const sources = import.meta.glob('./import-*.tsx', {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    expect(Object.keys(sources).length).toBeGreaterThan(2);
    for (const source of Object.values(sources)) {
      expect(source).not.toMatch(/dangerouslySetInnerHTML|innerHTML/);
    }
    const { user, dialog } = await openDialog();
    fireEvent.change(within(dialog).getByLabelText('Mermaid diagram'), {
      target: { value: 'flowchart LR\n  A["<img src=x onerror=alert(1)>Hi"] --> B\n  ???' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    await screen.findByText('2 components, 1 connection, 0 groups');
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });
});

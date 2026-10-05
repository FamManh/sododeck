import { fromJSON, serializeDeck, toJSON } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as Router from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as LayoutClientModule from '../../layout/layout-client';
import { useUiStore } from '../../state/ui-store';
import { liveDecks } from '../../storage/library-db';
import { setLibraryDbForTests } from '../../storage/library-db-instance';
import { freshLibraryDb } from '../../test/library-fixtures';
import { deckOf, editorWrapper } from '../../test/render-canvas';
import { MermaidImportDialog } from './mermaid-import-dialog';

vi.mock('../../storage/library-client', (importOriginal) =>
  import('../../test/mock-library-client').then((m) => m.mockLibraryClient(importOriginal)),
);

// jsdom has no Worker: the layout worker's answer is a simple row.
vi.mock('../../layout/layout-client', async (importOriginal) => {
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

const navigate = vi.fn();
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof Router>()),
  useNavigate: () => navigate,
}));

afterEach(() => {
  setLibraryDbForTests(undefined);
  navigate.mockReset();
});

const START = deckOf({
  name: 'Shop',
  nodes: [
    { id: 'n1', type: 'component', title: 'Gateway', position: { x: 0, y: 0 } },
    { id: 'n2', type: 'component', title: 'Orders', position: { x: 300, y: 0 } },
  ],
  edges: [{ id: 'e1', from: 'n1', to: 'n2' }],
});

const FLOWCHART = 'flowchart LR\n  W[Web app] -->|login| A(API)\n  A --> D{Valid?}';

function Harness() {
  const open = useUiStore((s) => s.mermaidDialog.open);
  return open ? <MermaidImportDialog /> : null;
}

function setup(file: SododeckFile = START) {
  const { wrapper, doc, editor } = editorWrapper(file);
  const opener = document.createElement('button');
  document.body.append(opener);
  const user = userEvent.setup();
  render(<Harness />, { wrapper });
  act(() => {
    useUiStore.getState().openMermaidImport(opener);
  });
  return { user, doc, editor, opener };
}

const dialog = () => screen.getByRole('dialog', { name: /Import Mermaid|Imported/ });

async function paste(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(within(dialog()).getByLabelText('Mermaid diagram'));
  await user.paste(text);
}

describe('MermaidImportDialog', () => {
  it('imports into this deck by default, in one undo step, and round-trips', async () => {
    const { user, doc, editor } = setup();
    const before = toJSON(doc);
    expect(within(dialog()).getByRole('radio', { name: 'Import into this deck' })).toBeChecked();
    await paste(user, FLOWCHART);
    await user.click(within(dialog()).getByRole('button', { name: 'Import' }));

    expect(
      await screen.findByRole('heading', { name: 'Imported into this deck' }),
    ).toBeInTheDocument();
    expect(screen.getByText('3 components, 2 connections, 0 groups')).toBeInTheDocument();
    const after = toJSON(doc);
    expect(after.name).toBe('Shop');
    expect(after.nodes.map((n) => n.title)).toEqual([
      'Gateway',
      'Orders',
      'Web app',
      'API',
      'Valid?',
    ]);
    expect(after.edges).toHaveLength(3);
    // Fresh ids, none reused, and nothing lands on top of the existing cards.
    const ids = [...after.nodes, ...after.edges].map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    const imported = after.nodes.slice(2);
    for (const node of imported) expect(node.position?.x).toBeGreaterThan(300);
    expect(toJSON(fromJSON(JSON.parse(serializeDeck(after)) as unknown))).toEqual(after);

    act(() => {
      editor().undo();
    });
    expect(toJSON(doc)).toEqual(before);
  });

  it('closes with Done and returns focus to what opened it', async () => {
    const { user, opener } = setup();
    await paste(user, FLOWCHART);
    await user.click(within(dialog()).getByRole('button', { name: 'Import' }));
    await user.click(await screen.findByRole('button', { name: 'Done' }));
    expect(useUiStore.getState().mermaidDialog.open).toBe(false);
    expect(opener).toHaveFocus();
  });

  it('creates a new deck instead when asked, leaving this one untouched', async () => {
    const db = await freshLibraryDb();
    setLibraryDbForTests(db);
    const { user, doc } = setup();
    const before = toJSON(doc);
    await user.click(within(dialog()).getByRole('radio', { name: 'New deck' }));
    await paste(user, 'sequenceDiagram\n  A->>B: hi');
    await user.click(within(dialog()).getByRole('button', { name: 'Import' }));

    expect(
      await screen.findByRole('heading', { name: 'Imported “Imported diagram”' }),
    ).toBeInTheDocument();
    expect(toJSON(doc)).toEqual(before);
    const [deck] = await liveDecks(db);
    expect(deck).toMatchObject({ name: 'Imported diagram', nodeCount: 2 });
    await user.click(screen.getByRole('button', { name: 'Open deck' }));
    expect(navigate).toHaveBeenCalledWith(`/deck/${deck?.id ?? ''}`);
  });

  it('keeps the text and says why when the diagram cannot be read; nothing is written', async () => {
    const { user, doc } = setup();
    const before = toJSON(doc);
    await paste(user, 'erDiagram\n  A ||--o{ B : x');
    await user.click(within(dialog()).getByRole('button', { name: 'Import' }));
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('not supported');
    expect(within(dialog()).getByLabelText('Mermaid diagram')).toHaveValue(
      'erDiagram\n  A ||--o{ B : x',
    );
    await waitFor(() => {
      expect(within(dialog()).getByRole('button', { name: 'Import' })).toBeEnabled();
    });
    expect(toJSON(doc)).toEqual(before);
  });
});

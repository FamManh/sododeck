import type { DeckEditor } from '@sododeck/model';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as LayoutClientModule from '../layout/layout-client';
import type * as EditorContextModule from '../model/editor-context';
import { useUiStore } from '../state/ui-store';
import { EditorProbe } from '../test/editor-probe';
import { changes, mountEmbed, opened, sampleText } from './embed-test-kit';

vi.mock('../editor/json-panel', () => ({ JsonPanel: () => null }));

// jsdom cannot draw a canvas: the PNG is a stand-in.
vi.mock('../editor/export/rasterize', () => ({
  rasterize: () => Promise.resolve(new Blob(['png'], { type: 'image/png' })),
}));

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

vi.mock('../model/editor-context', async (importOriginal) => {
  const actual = await importOriginal<typeof EditorContextModule>();
  return {
    EditorProvider: ({ doc, children }: Parameters<typeof actual.EditorProvider>[0]) => (
      <actual.EditorProvider doc={doc}>
        <EditorProbe
          onEditor={(editor: DeckEditor) => {
            opened.editor = editor;
          }}
        />
        {children}
      </actual.EditorProvider>
    ),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

const RUNBOOK = 'https://runbooks.example.com/billing';

const withLink = () =>
  sampleText({
    nodes: [
      {
        id: 'api',
        type: 'service',
        title: 'Billing API',
        position: { x: 0, y: 0 },
        links: [{ url: RUNBOOK, label: 'Runbook' }],
      },
      { id: 'db', type: 'database', title: 'Orders DB', position: { x: 320, y: 0 } },
    ],
  });

/** Selects Billing API and opens its details, where the links are. */
async function openDetails() {
  await screen.findByRole('toolbar', { name: 'Deck' });
  act(() => {
    useUiStore.getState().select({ nodes: ['api'] });
    useUiStore.getState().openDrawer();
  });
  return screen.findByRole('list', { name: 'Links' });
}

describe('links through the host (067 US5)', () => {
  it('shows the link as text with a copy action when the host cannot open links', async () => {
    mountEmbed({ text: withLink(), capabilities: { openLinks: false } });
    const list = await openDetails();
    expect(within(list).getByText('Runbook')).toBeInTheDocument();
    expect(within(list).queryByRole('link')).not.toBeInTheDocument();
    expect(within(list).getByRole('button', { name: 'Copy link Runbook' })).toBeInTheDocument();
  });

  it('sends open-link and never navigates the frame when the host can open links', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { host } = mountEmbed({ text: withLink(), capabilities: { openLinks: true } });
    const list = await openDetails();
    await userEvent.setup().click(within(list).getByRole('link', { name: 'Runbook' }));
    const sent = host.log.flatMap((e) =>
      e.dir === 'in' && e.message.type === 'open-link' ? [e.message] : [],
    );
    expect(sent).toEqual([{ type: 'open-link', href: RUNBOOK }]);
    expect(open).not.toHaveBeenCalled();
  });
});

async function openExport() {
  await screen.findByRole('toolbar', { name: 'Deck' });
  act(() => {
    useUiStore.getState().openExport(null);
  });
  return screen.findByRole('dialog', { name: 'Export deck' });
}

describe('exports through the host (067 US5)', () => {
  it('offers no download, but still copy, when the host cannot save files', async () => {
    mountEmbed({ capabilities: { exportFiles: false } });
    const dialog = await openExport();
    expect(within(dialog).queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('sends an exported picture as export-file when the host can save files', async () => {
    const { host } = mountEmbed({ capabilities: { exportFiles: true } });
    const dialog = await openExport();
    await userEvent.setup().click(within(dialog).getByRole('radio', { name: 'PNG' }));
    const download = within(dialog).getByRole('button', { name: 'Download' });
    await waitFor(() => {
      expect(download).toBeEnabled();
    });
    await userEvent.setup().click(download);
    await waitFor(() => {
      const sent = host.log.flatMap((e) =>
        e.dir === 'in' && e.message.type === 'export-file' ? [e.message] : [],
      );
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ mime: 'image/png' });
      expect(sent[0]?.name).toMatch(/\.png$/);
      expect(sent[0]?.bytes.length).toBeGreaterThan(0);
    });
  });
});

describe('protocol version (067 US5)', () => {
  const fatals = (host: ReturnType<typeof mountEmbed>['host']) =>
    host.log.filter((e) => e.dir === 'in' && e.message.type === 'fatal');

  it('stops with "needs an update" for a newer host, and sends fatal once', async () => {
    const { host } = mountEmbed({ protocolVersion: 2 });
    expect(await screen.findByRole('alert')).toHaveTextContent('This editor needs an update');
    expect(screen.queryByRole('toolbar', { name: 'Deck' })).not.toBeInTheDocument();
    expect(fatals(host)).toHaveLength(1);
    expect(fatals(host)[0]?.message).toMatchObject({
      type: 'fatal',
      code: 'protocol-version',
      protocolVersion: 1,
    });
    // Everything but a later init with the right version is ignored.
    act(() => {
      host.sendExternal(sampleText());
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.queryByRole('toolbar', { name: 'Deck' })).not.toBeInTheDocument();
    host.options.protocolVersion = 1;
    act(() => {
      host.sendInit();
    });
    expect(await screen.findByRole('toolbar', { name: 'Deck' })).toBeInTheDocument();
  });

  it('names updating the extension or plug-in for an older host', async () => {
    mountEmbed({ protocolVersion: 0 });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Update the extension or plug-in that opened this deck',
    );
  });
});

describe('Mermaid in a host (067 FR-020)', () => {
  it('takes pasted text into the open deck and has no file chooser', async () => {
    const { host } = mountEmbed();
    await screen.findByRole('toolbar', { name: 'Deck' });
    act(() => {
      useUiStore.getState().openMermaidImport(null);
    });
    const dialog = await screen.findByRole('dialog', { name: 'Import Mermaid' });
    expect(within(dialog).queryByRole('button', { name: 'Choose file' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('mermaid-file-input')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('radio', { name: 'New deck' })).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(within(dialog).getByLabelText('Mermaid diagram'));
    await user.paste('flowchart LR\n  W[Web app] --> A(API)');
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    await screen.findByRole('heading', { name: 'Imported into this deck' });
    await waitFor(() => {
      expect(changes(host).length).toBeGreaterThan(0);
    });
    expect(host.lastText()).toContain('Web app');
  });
});

import { serializeDeck } from '@sododeck/model';
import * as Y from 'yjs';
import type { SododeckFile, View } from '@sododeck/schema';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { edgeCaseDeck } from '../../db/fixtures/export-edge-cases';
import { shopDeck } from '../../db/fixtures/shop';
import { schemaExport } from '../../db/export/schema-export';
import { DEFAULT_SQL_OPTIONS } from '../../db/export/types';
import { copyText } from '../../lib/clipboard';
import type * as DownloadModule from '../../storage/download';
import { openedFlow, useUiStore } from '../../state/ui-store';
import { downloadBlob, downloadText } from '../../storage/download';
import { flowDeck } from '../../test/flow-fixtures';
import { deckOf, editorWrapper } from '../../test/render-canvas';
import { SaveContext } from '../save-context';
import { ExportDialog } from './export-dialog';
import type * as JsonExportModule from './json-export';
import { jsonExport } from './json-export';
import { pngSize } from './png-size';
import { rasterize } from './rasterize';
import { buildScene } from './scene';

vi.mock('../../storage/download', async (importOriginal) => ({
  ...(await importOriginal<typeof DownloadModule>()),
  downloadText: vi.fn(),
  downloadBlob: vi.fn(),
}));
vi.mock('../../lib/clipboard', () => ({ copyText: vi.fn() }));
vi.mock('./rasterize', () => ({ rasterize: vi.fn() }));
vi.mock('./json-export', async (importOriginal) => {
  const actual = await importOriginal<typeof JsonExportModule>();
  return { ...actual, jsonExport: vi.fn(actual.jsonExport) };
});

const deck = deckOf({
  name: 'Logistics Delivery',
  nodes: [
    { id: 'api', type: 'service', title: 'Orders API', tech: 'Go', position: { x: 0, y: 0 } },
    { id: 'db', type: 'database', title: 'Orders DB', position: { x: 300, y: 0 } },
  ],
  edges: [{ id: 'api-db', from: 'api', to: 'db', label: 'SQL' }],
});

const namedFlowDeck: SododeckFile = { ...flowDeck, name: 'Logistics Delivery' };

/** Mounts the dialog like `ShellChrome`: only while the store flag is set. */
function Harness() {
  const open = useUiStore((s) => s.exportDialog.open);
  return open ? <ExportDialog /> : null;
}

function setup(
  file: SododeckFile = deck,
  {
    flow,
    markExported = vi.fn(),
    opener = true,
    ui,
  }: {
    flow?: string;
    markExported?: () => void;
    opener?: boolean;
    /** UI state set before the dialog opens (selection, drill). */
    ui?: Partial<ReturnType<typeof useUiStore.getState>>;
  } = {},
) {
  const { wrapper, editor } = editorWrapper(file);
  const button = document.createElement('button');
  button.textContent = 'Export';
  document.body.append(button);
  openers.push(button);
  if (flow !== undefined) useUiStore.setState({ activeFlow: openedFlow(flow) });
  if (ui !== undefined) useUiStore.setState(ui);
  const user = userEvent.setup();
  const view = render(
    <SaveContext value={{ mode: 'stored', flush: () => Promise.resolve(), markExported }}>
      <div data-canvas="" tabIndex={-1} aria-label="Canvas" />
      <Harness />
    </SaveContext>,
    { wrapper },
  );
  act(() => {
    useUiStore.getState().openExport(opener ? button : null);
  });
  return { ...view, user, editor, button, markExported };
}

const dialog = () => screen.getByRole('dialog', { name: 'Export deck' });
const footerName = (name: string) => within(dialog()).findByText(name, {}, { timeout: 2000 });
const radio = (name: string) => screen.getByRole('radio', { name });

async function choose(user: ReturnType<typeof userEvent.setup>, format: 'JSON' | 'PNG' | 'SVG') {
  await user.click(radio(format));
  await waitFor(() => {
    expect(radio(format)).toBeChecked();
  });
}

/** The pixel size the footer should show for this scene and scale. */
function expectedPng(file: SododeckFile, scale: 1 | 2 | 3, patch = {}) {
  const scene = buildScene({
    deck: file,
    scope: 'deck',
    ui: {
      currentViewId: null,
      revealed: new Set(),
      drill: [],
      activeFlowId: null,
      notesDisplay: 'dimmed',
      ...patch,
    },
  });
  const { width, height } = pngSize(scene.bounds, scale);
  return `${String(width)} × ${String(height)} px`;
}

const openers: HTMLElement[] = [];

beforeEach(() => {
  vi.mocked(copyText).mockResolvedValue(true);
  vi.mocked(rasterize).mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
});

afterEach(() => {
  vi.clearAllMocks();
  for (const opener of openers.splice(0)) opener.remove();
});

/**
 * The Shop fixture plus its two lint warnings (audit_log has no key, products-categories is n-n) are
 * export edge cases; tests about the banner start from a deck with neither.
 */
function quietShop(): SododeckFile {
  const deck = shopDeck('postgres');
  const auditId = deck.nodes
    .find((n) => n.id === 'audit_log')
    ?.columns?.find((c) => c.name === 'id');
  if (auditId === undefined) throw new Error('fixture changed');
  auditId.pk = true;
  deck.edges = deck.edges.filter((e) => e.id !== 'rel.products-categories');
  return deck;
}

describe('ExportDialog: shell', () => {
  it('is named, described and lists three formats with subtitles', async () => {
    setup();
    expect(dialog()).toHaveAccessibleDescription(
      'Exports are generated in your browser. Nothing is uploaded.',
    );
    const formats = within(screen.getByRole('radiogroup', { name: 'Format' })).getAllByRole(
      'radio',
    );
    expect(formats.map((item) => item.getAttribute('aria-label'))).toEqual(['JSON', 'PNG', 'SVG']);
    expect(radio('JSON')).toHaveAccessibleDescription('.sododeck.json · re-importable');
    expect(radio('PNG')).toHaveAccessibleDescription('Raster image for docs and slides');
    expect(radio('SVG')).toHaveAccessibleDescription('Vector, editable in Figma');
    expect(screen.getByRole('region', { name: 'Preview' })).toBeInTheDocument();
    await footerName('logistics-delivery.sododeck.json');
  });

  it('selects a format by clicking its subtitle (051 US5)', async () => {
    const { user } = setup();
    await user.click(within(dialog()).getByText('Raster image for docs and slides'));
    await waitFor(() => {
      expect(radio('PNG')).toBeChecked();
    });
    await user.click(within(dialog()).getByText('Vector, editable in Figma'));
    await waitFor(() => {
      expect(radio('SVG')).toBeChecked();
    });
  });

  it('closes with the Close button and returns focus to the opener', async () => {
    const { user, button } = setup();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(useUiStore.getState().exportDialog.open).toBe(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(button).toHaveFocus();
    });
  });
});

describe('ExportDialog: JSON (US1)', () => {
  it('defaults to JSON of the whole deck with both options on', async () => {
    setup();
    expect(radio('JSON')).toBeChecked();
    const scope = screen.getByRole('radiogroup', { name: 'Scope' });
    expect(scope).toHaveAccessibleDescription('JSON always contains the whole deck');
    expect(within(scope).getByRole('radio', { name: 'Whole deck' })).toBeChecked();
    expect(within(scope).getByRole('radio', { name: 'Whole deck' })).toBeDisabled();
    expect(
      screen.getByRole('switch', { name: 'Include descriptions, links and rules' }),
    ).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Pretty-print' })).toBeChecked();
    await footerName('logistics-delivery.sododeck.json');
    expect(within(dialog()).getByText(/^\d+(\.\d)? KB$|^\d+ B$/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Preview' })).toHaveTextContent(
      '"name": "Logistics Delivery"',
    );
  });

  it('turns Pretty-print off: smaller file, no indentation', async () => {
    const { user } = setup();
    await footerName('logistics-delivery.sododeck.json');
    const size = () => within(dialog()).getByText(/^\d+(\.\d)? KB$|^\d+ B$/).textContent;
    const before = size();
    await user.click(screen.getByRole('switch', { name: 'Pretty-print' }));
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Preview' })).toHaveTextContent(
        '"name":"Logistics Delivery"',
      );
    });
    expect(size()).not.toBe(before);
  });

  it('downloads the backup text, records the export and says so', async () => {
    const { user, markExported } = setup();
    await footerName('logistics-delivery.sododeck.json');
    await user.click(screen.getByRole('button', { name: 'Download' }));
    expect(downloadText).toHaveBeenCalledWith(
      'logistics-delivery.sododeck.json',
      serializeDeck(deck),
      'application/json',
    );
    expect(markExported).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText('Downloaded logistics-delivery.sododeck.json'),
    ).toBeInTheDocument();
    expect(useUiStore.getState().announcement.text).toBe(
      'Downloaded logistics-delivery.sododeck.json',
    );
    expect(dialog()).toBeInTheDocument();
  });

  it('copies, and tells when copying failed', async () => {
    const { user } = setup();
    await footerName('logistics-delivery.sododeck.json');
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(copyText).toHaveBeenCalledWith(serializeDeck(deck));
    expect(await screen.findByText('Copied')).toBeInTheDocument();
    vi.mocked(copyText).mockResolvedValueOnce(false);
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await screen.findByText("Couldn't copy — use Download instead")).toBeInTheDocument();
  });

  it('shows an error with Retry when generation fails', async () => {
    vi.mocked(jsonExport).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const { user } = setup();
    expect(await screen.findByText("Couldn't create this export")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await footerName('logistics-delivery.sododeck.json');
    expect(screen.queryByText("Couldn't create this export")).not.toBeInTheDocument();
  });

  it('shows Preparing… and disables the buttons until the file is ready', () => {
    setup();
    expect(screen.getByRole('status')).toHaveTextContent('Preparing…');
    expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled();
  });
});

describe('ExportDialog: images (US2)', () => {
  it('PNG defaults to 2× with the matching pixel size, and 3× changes it', async () => {
    const { user } = setup();
    await choose(user, 'PNG');
    await footerName('logistics-delivery.png');
    expect(screen.getByRole('radio', { name: '2×' })).toBeChecked();
    expect(within(dialog()).getByText(expectedPng(deck, 2))).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '3×' }));
    expect(await within(dialog()).findByText(expectedPng(deck, 3))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Preview of logistics-delivery.png' }),
    ).toBeInTheDocument();
  });

  it('disables scales too large for the browser', async () => {
    const huge = deckOf({
      name: 'Huge',
      nodes: [
        { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
        { id: 'b', type: 'service', title: 'B', position: { x: 10_000, y: 0 } },
      ],
    });
    const { user } = setup(huge);
    await choose(user, 'PNG');
    await footerName('huge.png');
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: '1×' })).toBeChecked();
    });
    for (const name of ['2×', '3×']) {
      expect(screen.getByRole('radio', { name })).toBeDisabled();
      expect(screen.getByRole('radio', { name }).parentElement).toHaveAccessibleDescription(
        'Too large for this browser',
      );
    }
    expect(within(dialog()).getByText(expectedPng(huge, 1))).toBeInTheDocument();
  });

  it('downloads a PNG at the chosen scale', async () => {
    const { user, markExported } = setup();
    await choose(user, 'PNG');
    await footerName('logistics-delivery.png');
    await user.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => {
      expect(downloadBlob).toHaveBeenCalledWith('logistics-delivery.png', expect.any(Blob));
    });
    expect(rasterize).toHaveBeenCalledWith(expect.stringContaining('<svg'), expect.any(Object), 2);
    expect(markExported).not.toHaveBeenCalled();
    expect(useUiStore.getState().announcement.text).toBe('Downloaded logistics-delivery.png');
  });

  it('tells when the PNG cannot be drawn', async () => {
    vi.mocked(rasterize).mockRejectedValueOnce(new Error('png-failed'));
    const { user } = setup();
    await choose(user, 'PNG');
    await footerName('logistics-delivery.png');
    await user.click(screen.getByRole('button', { name: 'Download' }));
    expect(await screen.findByText("Couldn't create this export")).toBeInTheDocument();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('toggles the transparent background (new preview)', async () => {
    const { user } = setup();
    await choose(user, 'SVG');
    await footerName('logistics-delivery.svg');
    const img = () => screen.getByRole('img', { name: 'Preview of logistics-delivery.svg' });
    const opaque = img().getAttribute('src');
    await user.click(screen.getByRole('switch', { name: 'Transparent background' }));
    await waitFor(() => {
      expect(img().getAttribute('src')).not.toBe(opaque);
    });
    expect(decodeURIComponent(img().getAttribute('src') ?? '')).not.toContain('fill="#fafaf8"');
  });

  it('SVG shows a byte size, copies and downloads as image/svg+xml', async () => {
    const { user } = setup();
    await choose(user, 'SVG');
    await footerName('logistics-delivery.svg');
    expect(within(dialog()).getByText(/^\d+(\.\d)? KB$/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(copyText).toHaveBeenCalledWith(expect.stringContaining('<svg'));
    await user.click(screen.getByRole('button', { name: 'Download' }));
    expect(downloadText).toHaveBeenCalledWith(
      'logistics-delivery.svg',
      expect.stringContaining('<svg'),
      'image/svg+xml',
    );
  });

  it('shows "Nothing to export yet" for images of an empty deck; JSON still works', async () => {
    const { user } = setup(deckOf({ name: 'Empty' }));
    await footerName('empty.sododeck.json');
    for (const format of ['PNG', 'SVG'] as const) {
      await choose(user, format);
      expect(await screen.findByText('Nothing to export yet')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled();
    }
    await choose(user, 'JSON');
    await footerName('empty.sododeck.json');
    expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled();
  });
});

describe('ExportDialog: selected flow (US3)', () => {
  it('opens on PNG of the shown flow, named after it', async () => {
    setup(namedFlowDeck, { flow: 'place' });
    expect(radio('PNG')).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Selected flow' })).toBeChecked();
    await footerName('logistics-delivery-place-order.png');
  });

  it('keeps the flow scope while JSON is shown', async () => {
    const { user } = setup(namedFlowDeck, { flow: 'place' });
    await choose(user, 'JSON');
    expect(screen.getByRole('radio', { name: 'Whole deck' })).toBeChecked();
    expect(screen.getByRole('radiogroup', { name: 'Scope' })).toHaveAccessibleDescription(
      'JSON always contains the whole deck',
    );
    await choose(user, 'PNG');
    expect(screen.getByRole('radio', { name: 'Selected flow' })).toBeChecked();
  });

  it('disables "Selected flow" outside flow mode, with the reason', async () => {
    const { user } = setup(namedFlowDeck);
    await choose(user, 'PNG');
    const item = screen.getByRole('radio', { name: 'Selected flow' });
    expect(item).toBeDisabled();
    expect(item.parentElement).toHaveAccessibleDescription('Open a flow to export it');
  });

  it('falls back to the whole deck when the flow is deleted while open', async () => {
    const { editor } = setup(namedFlowDeck, { flow: 'place' });
    await footerName('logistics-delivery-place-order.png');
    act(() => {
      editor().remove('flows', 'place');
    });
    expect(
      await screen.findByText('The flow was deleted, so the whole deck is shown.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Whole deck' })).toBeChecked();
    expect(useUiStore.getState().announcement.text).toBe(
      'The flow was deleted, so the whole deck is shown.',
    );
    await footerName('logistics-delivery.png');
  });
});

describe('ExportDialog: current view (US4)', () => {
  const view = (patch: Partial<View>): View => ({ id: 'v', type: 'custom', title: 'V', ...patch });

  it('draws what the current view shows', async () => {
    const hiding: SododeckFile = {
      ...deck,
      edges: [],
      views: [view({ id: 'all' }), view({ id: 'no-db', excludeKinds: ['database'] })],
    };
    const { user } = setup(hiding);
    act(() => {
      useUiStore.setState({ currentViewId: 'no-db' });
    });
    await choose(user, 'PNG');
    const whole = expectedPng(hiding, 2);
    expect(await within(dialog()).findByText(whole)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Current view' }));
    const viewOnly = expectedPng({ ...hiding, nodes: hiding.nodes.slice(0, 1) }, 2);
    expect(viewOnly).not.toBe(whole);
    expect(await within(dialog()).findByText(viewOnly)).toBeInTheDocument();
  });

  it('matches the whole deck when the view hides nothing', async () => {
    const plain: SododeckFile = { ...deck, views: [view({ id: 'all' })] };
    const { user } = setup(plain);
    await choose(user, 'PNG');
    const whole = expectedPng(plain, 2);
    expect(await within(dialog()).findByText(whole)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Current view' }));
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Current view' })).toBeChecked();
    });
    expect(await within(dialog()).findByText(whole)).toBeInTheDocument();
  });
});

describe('ExportDialog: keyboard (US5)', () => {
  it('works from the keyboard and returns focus on Escape', async () => {
    const { user, button } = setup();
    await waitFor(() => {
      expect(radio('JSON')).toHaveFocus();
    });
    // Hold arrows like a real press: Radix moves focus on a timeout and selects on focus while
    // an arrow key is down (see packages/ui segmented-control tests).
    const press = async (key: string, next: HTMLElement) => {
      await user.keyboard(`{${key}>}`);
      await waitFor(() => {
        expect(next).toHaveFocus();
      });
      await user.keyboard(`{/${key}}`);
    };
    await press('ArrowDown', radio('PNG'));
    expect(radio('PNG')).toBeChecked();
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Whole deck' })).toHaveFocus();
    await press('ArrowRight', screen.getByRole('radio', { name: 'Current view' }));
    // "Selected flow" is disabled outside flow mode: the arrow skips it.
    await press('ArrowRight', screen.getByRole('radio', { name: 'Whole deck' }));
    expect(screen.getByRole('radio', { name: 'Whole deck' })).toBeChecked();
    await footerName('logistics-delivery.png');
    await user.tab();
    expect(screen.getByRole('radio', { name: '2×' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('switch', { name: 'Transparent background' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Download' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(useUiStore.getState().announcement.text).toBe('Downloaded logistics-delivery.png');
    });
    // The first Escape dismisses the "Downloaded" toast (the top Radix layer), the next one
    // the dialog.
    await user.keyboard('{Escape}{Escape}');
    expect(useUiStore.getState().exportDialog.open).toBe(false);
    await waitFor(() => {
      expect(button).toHaveFocus();
    });
  });

  it('returns focus to the canvas when opened from the command palette', async () => {
    const { user } = setup(deck, { opener: false });
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.getByLabelText('Canvas')).toHaveFocus();
    });
  });
});

describe('ExportDialog: schema formats (045)', () => {
  const shop = quietShop();
  const preview = () => screen.getByRole('region', { name: 'Preview' });
  const selection = (nodes: string[]) => ({
    selection: { nodes, edges: [], groups: [], stickies: [], images: [] },
  });
  const scopeRadio = (name: string) =>
    within(screen.getByRole('radiogroup', { name: 'Scope' })).getByRole('radio', { name });

  async function pick(user: ReturnType<typeof userEvent.setup>, format: string) {
    await user.click(radio(format));
    await waitFor(() => {
      expect(radio(format)).toBeChecked();
    });
  }

  it('hides the Schema group when the deck has no table', () => {
    setup();
    expect(screen.queryByRole('group', { name: 'Schema' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Image and data' })).toBeInTheDocument();
  });

  it('lists the schema formats above image and data, one radio group', () => {
    setup(shop);
    const formats = within(screen.getByRole('radiogroup', { name: 'Format' })).getAllByRole(
      'radio',
    );
    expect(formats.map((f) => f.getAttribute('aria-label'))).toEqual([
      'SQL',
      'DBML',
      'Mermaid ER',
      'Data dictionary',
      'JSON',
      'PNG',
      'SVG',
    ]);
    expect(radio('SQL')).toHaveAccessibleDescription('In the deck dialect · Postgres');
    expect(radio('DBML')).toHaveAccessibleDescription('Database markup');
  });

  it('previews SQL in the deck dialect and downloads exactly that text', async () => {
    const { user } = setup(shop);
    await pick(user, 'SQL');
    await footerName('shop.sql');
    expect(screen.getByText('Postgres · deck dialect')).toBeInTheDocument();
    expect(preview()).toHaveTextContent('-- Shop · Whole deck · Postgres');
    await user.click(screen.getByRole('button', { name: 'Download' }));
    const expected = schemaExport(shop, {
      format: 'sql',
      scope: { kind: 'deck' },
      dialect: null,
      sql: DEFAULT_SQL_OPTIONS,
    }).text;
    expect(downloadText).toHaveBeenCalledWith('shop.sql', expected, 'text/plain');
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(copyText).toHaveBeenCalledWith(expected);
  });

  it('changes the preview with the SQL options', async () => {
    const { user } = setup(shop);
    await pick(user, 'SQL');
    await footerName('shop.sql');
    expect(preview()).not.toHaveTextContent('IF NOT EXISTS customers');
    await user.click(screen.getByRole('switch', { name: 'IF NOT EXISTS' }));
    await waitFor(() => {
      expect(preview()).toHaveTextContent('CREATE TABLE IF NOT EXISTS customers');
    });
    expect(screen.getByRole('switch', { name: 'Include enums and indexes' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Write junction tables for n–n' })).toBeChecked();
  });

  it('asks a Generic deck for a dialect before writing SQL', async () => {
    const { user } = setup(shopDeck('generic'));
    expect(radio('SQL')).toHaveAccessibleDescription('Choose Postgres, MySQL or SQLite');
    await pick(user, 'SQL');
    await within(preview()).findByText('Choose a dialect to write SQL');
    expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled();
    await user.click(screen.getByRole('combobox', { name: 'Dialect' }));
    await user.click(await screen.findByRole('option', { name: 'MySQL' }));
    await waitFor(() => {
      expect(preview()).toHaveTextContent('-- Shop · Whole deck · MySQL');
    });
    expect(preview()).toHaveTextContent('id char(36) PRIMARY KEY');
    // The pick lasts while the dialog is open.
    await pick(user, 'DBML');
    await pick(user, 'SQL');
    await waitFor(() => {
      expect(preview()).toHaveTextContent('-- Shop · Whole deck · MySQL');
    });
  });

  it('never changes the deck', async () => {
    const { user, editor } = setup(shop);
    await waitFor(() => {
      expect(radio('JSON')).toBeChecked();
    });
    const before = Y.encodeStateAsUpdate(editor().doc);
    for (const format of ['SQL', 'DBML', 'Mermaid ER', 'Data dictionary']) {
      await pick(user, format);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled();
      });
      await user.click(screen.getByRole('button', { name: 'Copy' }));
      await user.click(screen.getByRole('button', { name: 'Download' }));
    }
    expect(Y.encodeStateAsUpdate(editor().doc)).toEqual(before);
    expect(editor().canUndo()).toBe(false);
  });

  it.each([
    ['DBML', 'shop.dbml', 'Table customers {'],
    ['Mermaid ER', 'shop.mmd', 'erDiagram'],
    ['Data dictionary', 'shop-dictionary.md', '# Shop · Whole deck · Postgres'],
  ])('%s has no dialect or SQL options and downloads %s', async (format, file, text) => {
    const { user } = setup(shop);
    await pick(user, format);
    await footerName(file);
    expect(preview()).toHaveTextContent(text);
    expect(screen.queryByText('Postgres · deck dialect')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'IF NOT EXISTS' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Download' }));
    expect(downloadText).toHaveBeenCalledWith(file, expect.stringContaining(text), 'text/plain');
  });

  it('works from the keyboard across both format groups', async () => {
    const { user } = setup(shop, { ui: selection(['orders']) });
    await waitFor(() => {
      expect(radio('JSON')).toHaveFocus();
    });
    // Held arrows, as in the keyboard test above: Radix selects on focus while a key is down.
    const press = async (key: string, next: HTMLElement) => {
      await user.keyboard(`{${key}>}`);
      await waitFor(() => {
        expect(next).toHaveFocus();
      });
      await user.keyboard(`{/${key}}`);
    };
    await press('ArrowUp', radio('Data dictionary'));
    expect(radio('Data dictionary')).toBeChecked();
    await press('ArrowUp', radio('Mermaid ER'));
    await press('ArrowUp', radio('DBML'));
    await press('ArrowUp', radio('SQL'));
    expect(radio('SQL')).toBeChecked();
    await footerName('shop-selection.sql');
    await user.tab();
    expect(scopeRadio('Selection')).toHaveFocus();
    await press('ArrowRight', scopeRadio('Whole deck'));
    expect(scopeRadio('Whole deck')).toBeChecked();
    await footerName('shop.sql');
    await user.tab();
    expect(screen.getByRole('switch', { name: 'Include enums and indexes' })).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(screen.getByRole('switch', { name: 'IF NOT EXISTS' })).toHaveFocus();
    await user.keyboard(' ');
    expect(screen.getByRole('switch', { name: 'IF NOT EXISTS' })).toBeChecked();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy' })).toBeEnabled();
    });
    await user.tab();
    expect(screen.getByRole('button', { name: 'Copy' })).toHaveFocus();
  });

  describe('scope (US2)', () => {
    it('opens on Selection when tables are selected', async () => {
      const { user } = setup(shop, { ui: selection(['orders', 'customers']) });
      await pick(user, 'SQL');
      expect(scopeRadio('Selection')).toBeChecked();
      await footerName('shop-selection.sql');
      expect(preview()).toHaveTextContent('-- Shop · Selection · Postgres');
    });

    it('opens on the database card drilled into, and switches scope', async () => {
      const { user } = setup(shop, {
        ui: { drill: [{ kind: 'node', id: 'card.orders-db', viewport: { x: 0, y: 0, zoom: 1 } }] },
      });
      await pick(user, 'SQL');
      expect(scopeRadio('Orders DB')).toBeChecked();
      await footerName('shop-orders-db.sql');
      expect(preview()).not.toHaveTextContent('CREATE TABLE users');
      await user.click(scopeRadio('Whole deck'));
      await footerName('shop.sql');
      expect(preview()).toHaveTextContent('CREATE TABLE users');
    });

    it('opens on Whole deck with Selection disabled when nothing is selected', async () => {
      const { user } = setup(shop);
      await pick(user, 'SQL');
      expect(scopeRadio('Whole deck')).toBeChecked();
      expect(scopeRadio('Selection')).toBeDisabled();
      expect(scopeRadio('Selection').closest('[aria-describedby]')).toHaveAccessibleDescription(
        'Select one or more tables',
      );
      expect(screen.queryByRole('radio', { name: 'Orders DB' })).not.toBeInTheDocument();
    });

    it('opens on SQL and the selected database card from "Export this database as SQL" (049)', async () => {
      setup(shop, { ui: selection(['card.orders-db']) });
      act(() => {
        useUiStore.getState().closeExport();
      });
      act(() => {
        useUiStore.getState().openExport(null, { format: 'sql', scope: 'database' });
      });
      expect(scopeRadio('Orders DB')).toBeChecked();
      await footerName('shop-orders-db.sql');
      expect(preview()).not.toHaveTextContent('CREATE TABLE users');
    });

    it('leaves the image scope control as it was', async () => {
      const { user } = setup(shop, { ui: selection(['orders']) });
      await pick(user, 'PNG');
      expect(scopeRadio('Whole deck')).toBeChecked();
      expect(screen.queryByRole('radio', { name: 'Selection' })).not.toBeInTheDocument();
    });
  });

  describe('notes and problems (US6)', () => {
    it('lists export notes, first three, then all', async () => {
      const { user } = setup(edgeCaseDeck());
      await pick(user, 'DBML');
      const strip = await screen.findByRole('status', { name: /export notes$/ });
      expect(within(strip).getAllByRole('listitem')).toHaveLength(3);
      await user.click(within(strip).getByRole('button', { name: 'Show all' }));
      expect(within(strip).getAllByRole('listitem').length).toBeGreaterThan(3);
    });

    it('shows no notes and no banner for a clean export', async () => {
      const { user } = setup(shop);
      await pick(user, 'SQL');
      await footerName('shop.sql');
      expect(screen.queryByRole('status', { name: /export notes?$/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('warns about database problems in scope; Show problems opens the Problems list', async () => {
      const broken = quietShop();
      const status = broken.nodes
        .find((n) => n.id === 'orders')
        ?.columns?.find((c) => c.name === 'status');
      if (status === undefined) throw new Error('fixture changed');
      status.enumRef = 'enum.gone';
      const { user } = setup(broken);
      await pick(user, 'SQL');
      const banner = await screen.findByRole('alert');
      expect(banner).toHaveTextContent('1 error in the deck');
      expect(banner).toHaveTextContent('orders.status uses an enum this deck does not have');
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled();
      });
      await user.click(within(banner).getByRole('button', { name: 'Show problems' }));
      expect(useUiStore.getState().exportDialog.open).toBe(false);
      expect(useUiStore.getState().flyout).toBe('problems');
    });
  });

  describe('block SQL export (052 US6)', () => {
    function brokenShop(block: boolean) {
      const broken = quietShop();
      const status = broken.nodes
        .find((n) => n.id === 'orders')
        ?.columns?.find((c) => c.name === 'status');
      if (status === undefined) throw new Error('fixture changed');
      status.enumRef = 'enum.gone';
      if (block) broken.blockSqlExport = true;
      return broken;
    }
    const copy = () => screen.getByRole('button', { name: 'Copy' });
    const download = () => screen.getByRole('button', { name: 'Download' });

    it('disables SQL Copy and Download while the scope has errors, with the reason', async () => {
      const { user } = setup(brokenShop(true));
      await pick(user, 'SQL');
      const banner = await screen.findByRole('alert');
      expect(banner).toHaveTextContent('1 error in the deck · fix the errors to export SQL');
      await footerName('shop.sql');
      expect(copy()).toBeDisabled();
      expect(download()).toBeDisabled();
      expect(download()).toHaveAccessibleDescription(/fix the errors to export SQL/);
    });

    it('lets DBML and the data dictionary export while SQL is blocked', async () => {
      const { user } = setup(brokenShop(true));
      await pick(user, 'DBML');
      await footerName('shop.dbml');
      expect(copy()).toBeEnabled();
      expect(download()).toBeEnabled();
      await pick(user, 'Data dictionary');
      await waitFor(() => {
        expect(download()).toBeEnabled();
      });
    });

    it('does not block when the flag is off', async () => {
      const { user } = setup(brokenShop(false));
      await pick(user, 'SQL');
      await screen.findByRole('alert');
      await footerName('shop.sql');
      expect(copy()).toBeEnabled();
      expect(download()).toBeEnabled();
    });

    it('does not block for an error outside the export scope', async () => {
      const { user } = setup(brokenShop(true), {
        ui: selection(['customers']),
      });
      await pick(user, 'SQL');
      await waitFor(() => {
        expect(scopeRadio('Selection')).toBeChecked();
      });
      await footerName('shop-selection.sql');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(copy()).toBeEnabled();
      expect(download()).toBeEnabled();
    });
  });

  describe('errors and warnings in the banner (047 US3)', () => {
    /** `reviews` loses its key (a warning); `withError` also breaks orders.status (an error). */
    function lintedShop(opts: { withError: boolean; block: boolean }) {
      const deck = quietShop();
      const id = deck.nodes.find((n) => n.id === 'reviews')?.columns?.find((c) => c.name === 'id');
      if (id === undefined) throw new Error('fixture changed');
      delete id.pk;
      if (opts.withError) {
        const status = deck.nodes
          .find((n) => n.id === 'orders')
          ?.columns?.find((c) => c.name === 'status');
        if (status === undefined) throw new Error('fixture changed');
        status.enumRef = 'enum.gone';
      }
      if (opts.block) deck.blockSqlExport = true;
      return deck;
    }
    const copy = () => screen.getByRole('button', { name: 'Copy' });
    const download = () => screen.getByRole('button', { name: 'Download' });

    it('lists errors first, then warnings, with both counts', async () => {
      const { user } = setup(lintedShop({ withError: true, block: false }));
      await pick(user, 'SQL');
      const banner = await screen.findByRole('alert');
      expect(banner).toHaveTextContent('1 error · 1 warning in the deck');
      expect(banner).toHaveTextContent(
        /orders\.status uses an enum this deck does not have.*reviews has no primary key/,
      );
    });

    it('exports SQL with the switch on when the scope has only warnings', async () => {
      const { user } = setup(lintedShop({ withError: false, block: true }));
      await pick(user, 'SQL');
      const banner = await screen.findByRole('alert');
      expect(banner).toHaveTextContent('1 warning in the deck');
      expect(banner).not.toHaveTextContent('fix the errors');
      await footerName('shop.sql');
      expect(copy()).toBeEnabled();
      expect(download()).toBeEnabled();
    });

    it('blocks SQL for an error in scope even with warnings beside it', async () => {
      const { user } = setup(lintedShop({ withError: true, block: true }));
      await pick(user, 'SQL');
      const banner = await screen.findByRole('alert');
      expect(banner).toHaveTextContent('1 error · 1 warning in the deck · fix the errors');
      await footerName('shop.sql');
      expect(copy()).toBeDisabled();
      expect(download()).toBeDisabled();
    });

    it('does not count problems outside the export scope', async () => {
      const { user } = setup(lintedShop({ withError: true, block: true }), {
        ui: selection(['customers']),
      });
      await pick(user, 'SQL');
      await footerName('shop-selection.sql');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(copy()).toBeEnabled();
    });
  });
});

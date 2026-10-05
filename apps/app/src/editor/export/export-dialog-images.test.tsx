import { assetId, encodeBase64 } from '@sododeck/model';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PNG_1X1 } from '../../images/test-pictures';
import { copyText } from '../../lib/clipboard';
import type * as DownloadModule from '../../storage/download';
import { useUiStore } from '../../state/ui-store';
import { deckOf, editorWrapper } from '../../test/render-canvas';
import { SaveContext } from '../save-context';
import { ExportDialog } from './export-dialog';
import { rasterize } from './rasterize';

vi.mock('../../storage/download', async (importOriginal) => ({
  ...(await importOriginal<typeof DownloadModule>()),
  downloadText: vi.fn(),
  downloadBlob: vi.fn(),
}));
vi.mock('../../lib/clipboard', () => ({ copyText: vi.fn() }));
vi.mock('./rasterize', () => ({ rasterize: vi.fn() }));

const ASSET = assetId(PNG_1X1);
const GONE = 'e'.repeat(64);
const DATA_URI = `data:image/png;base64,${encodeBase64(PNG_1X1)}`;
const meta = (name: string) => ({
  type: 'image/png' as const,
  bytes: PNG_1X1.length,
  width: 1,
  height: 1,
  name,
  data: '',
});

const deck = deckOf({
  name: 'Pictures',
  nodes: [{ id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } }],
  images: [
    {
      id: 'i1',
      asset: ASSET,
      position: { x: 300, y: 0 },
      size: { width: 120, height: 80 },
      alt: 'Logo',
    },
    {
      id: 'i2',
      asset: GONE,
      position: { x: 600, y: 0 },
      size: { width: 240, height: 140 },
    },
  ],
  assets: { [ASSET]: meta('logo.png'), [GONE]: meta('gone.png') },
});

function Harness() {
  const open = useUiStore((s) => s.exportDialog.open);
  return open ? <ExportDialog /> : null;
}

async function setup(file = deck) {
  const { wrapper, store } = editorWrapper(file);
  await store.put(ASSET, { type: 'image/png', bytes: PNG_1X1 });
  render(
    <SaveContext value={{ mode: 'stored', flush: () => Promise.resolve(), markExported: vi.fn() }}>
      <div data-canvas="" tabIndex={-1} aria-label="Canvas" />
      <Harness />
    </SaveContext>,
    { wrapper },
  );
  act(() => {
    useUiStore.getState().openExport(null);
  });
  return userEvent.setup();
}

beforeEach(() => {
  vi.mocked(copyText).mockResolvedValue(true);
  vi.mocked(rasterize).mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
});
afterEach(() => {
  vi.clearAllMocks();
});

describe('images in the export dialog (055)', () => {
  it('SVG carries the picture as a data URI and draws the missing one as a placeholder', async () => {
    const user = await setup();
    await user.click(screen.getByRole('radio', { name: 'SVG' }));
    await within(screen.getByRole('dialog', { name: 'Export deck' })).findByText(
      'pictures.svg',
      {},
      { timeout: 3000 },
    );
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    const svg = String(vi.mocked(copyText).mock.calls[0]?.[0]);
    expect(svg).toContain(`href="${DATA_URI}"`);
    expect(svg).toContain('Picture missing');
    expect(svg).toContain('gone.png');
    expect(svg).not.toMatch(/(?:href|src)="(?!data:|#)/);
  });

  it('PNG rasterises the SVG that already holds its pictures', async () => {
    const user = await setup();
    await user.click(screen.getByRole('radio', { name: 'PNG' }));
    await within(screen.getByRole('dialog', { name: 'Export deck' })).findByText(
      'pictures.png',
      {},
      { timeout: 3000 },
    );
    await user.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => {
      expect(rasterize).toHaveBeenCalledWith(
        expect.stringContaining(DATA_URI),
        expect.any(Object),
        expect.any(Number),
      );
    });
  });

  it('PNG of a cropped, flipped image rasterises the same nested <svg viewBox> (057)', async () => {
    const first = deck.images?.[0];
    if (first === undefined) throw new Error('no image');
    const edited = deckOf({
      ...deck,
      images: [{ ...first, crop: { x: 0, y: 0, width: 1, height: 0.5 }, flipX: true }],
      assets: { [ASSET]: { ...meta('logo.png'), width: 4, height: 2 } },
    });
    const user = await setup(edited);
    await user.click(screen.getByRole('radio', { name: 'PNG' }));
    await within(screen.getByRole('dialog', { name: 'Export deck' })).findByText(
      'pictures.png',
      {},
      { timeout: 3000 },
    );
    await user.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => {
      expect(rasterize).toHaveBeenCalled();
    });
    const svg = String(vi.mocked(rasterize).mock.calls[0]?.[0]);
    expect(svg).toContain('viewBox="0 0 4 1"');
    expect(svg).toContain('transform="translate(4 0) scale(-1 1)"');
    expect(svg).toContain(DATA_URI);
  });

  it('shows the busy state while the pictures are read', async () => {
    const user = await setup();
    await user.click(screen.getByRole('radio', { name: 'SVG' }));
    expect(screen.getByRole('dialog', { name: 'Export deck' })).toHaveTextContent('Preparing…');
    await within(screen.getByRole('dialog', { name: 'Export deck' })).findByText(
      'pictures.svg',
      {},
      { timeout: 3000 },
    );
    expect(screen.getByRole('dialog', { name: 'Export deck' })).not.toHaveTextContent('Preparing…');
  });
});

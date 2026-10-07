import { assetId, type DeckEditor } from '@sododeck/model';
import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PNG_1X1 } from '../images/test-pictures';
import type * as EditorContextModule from '../model/editor-context';
import { EditorProbe } from '../test/editor-probe';
import type * as EmbedPicturesModule from './embed-pictures';
import type { HostPictureStore } from './host-picture-store';
import { changes, mountEmbed, opened, SAMPLE, sampleText } from './embed-test-kit';

vi.mock('../editor/json-panel', () => ({ JsonPanel: () => null }));

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

// The embed's picture store, to add a picture the way the add-images pipeline does.
const captured = vi.hoisted(() => ({ store: undefined as HostPictureStore | undefined }));
vi.mock('./embed-pictures', async (importOriginal) => {
  const actual = await importOriginal<typeof EmbedPicturesModule>();
  return {
    ...actual,
    createEmbedPictures: (...args: Parameters<typeof actual.createEmbedPictures>) => {
      const made = actual.createEmbedPictures(...args);
      captured.store = made.store;
      return made;
    },
  };
});

const ID = assetId(PNG_1X1);
const FACTS = { type: 'image/png', bytes: PNG_1X1.length, width: 1, height: 1, name: 'dot.png' };

/** What the add-images pipeline does: the store first, then the image object in one step. */
async function addPicture() {
  await captured.store?.put(ID, { type: 'image/png', bytes: PNG_1X1, name: 'dot.png' });
  act(() => {
    opened.editor?.addImages([
      {
        asset: ID,
        meta: FACTS as Parameters<DeckEditor['addImages']>[0][number]['meta'],
        position: { x: 0, y: 200 },
        size: { width: 64, height: 64 },
      },
    ]);
  });
}

const assetOf = (text: string | null) =>
  (JSON.parse(text ?? '{}') as { assets?: Record<string, Record<string, unknown>> }).assets?.[ID];

const pointedDeck = () =>
  sampleText({
    images: [{ id: 'i1', asset: ID, position: { x: 0, y: 200 }, size: { width: 64, height: 64 } }],
    assets: { [ID]: { ...FACTS, path: 'assets/dot.png' } } as never,
  });

const types = (host: ReturnType<typeof mountEmbed>['host'], dir: 'in' | 'out') =>
  host.log.flatMap((e) => (e.dir === dir ? [e.message.type] : []));

describe('pictures through the host (067 US4)', () => {
  it('hands a new picture to the host, then writes its path instead of its data', async () => {
    const { host } = mountEmbed({ capabilities: { pictures: true } });
    await screen.findByRole('toolbar', { name: 'Deck' });
    await addPicture();
    await waitFor(() => {
      expect(assetOf(host.lastText())?.path).toBe('assets/dot.png');
    });
    const entry = assetOf(host.lastText());
    expect(entry).not.toHaveProperty('data');
    const inbound = types(host, 'in');
    const outbound = types(host, 'out');
    expect(inbound).toContain('picture-put');
    expect(outbound).toContain('picture-stored');
    const node = await screen.findByTestId('image-node');
    await waitFor(() => {
      expect(node.querySelector('img')).not.toBeNull();
    });
  });

  it('asks the host for a picture the deck names by path, and shows it', async () => {
    const pictures = new Map([[ID, { mime: 'image/png', bytes: PNG_1X1 }]]);
    const { host } = mountEmbed({
      text: pointedDeck(),
      capabilities: { pictures: true },
      pictures,
    });
    const node = await screen.findByTestId('image-node');
    await waitFor(() => {
      expect(types(host, 'in')).toContain('picture-get');
    });
    await waitFor(() => {
      expect(node.querySelector('img')).not.toBeNull();
    });
    expect(screen.queryByTestId('image-missing')).not.toBeInTheDocument();
  });

  it('shows the host’s reason when it has no such picture', async () => {
    mountEmbed({ text: pointedDeck(), capabilities: { pictures: true } });
    const missing = await screen.findByTestId('image-missing', {}, { timeout: 4000 });
    expect(missing).toHaveTextContent('Picture missing');
    expect(missing).toHaveTextContent('No such picture');
  });

  it('keeps the picture inside the file and says why when the host refuses it', async () => {
    const { host } = mountEmbed({ capabilities: { pictures: true }, refusePictures: true });
    await screen.findByRole('toolbar', { name: 'Deck' });
    await addPicture();
    expect(
      await screen.findByText('Picture kept inside the deck file: Pictures are refused'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(changes(host).length).toBeGreaterThan(0);
    });
    const entry = assetOf(host.lastText());
    expect(typeof entry?.data).toBe('string');
    expect(entry).not.toHaveProperty('path');
  });

  it('embeds the picture and sends no picture message without the ability', async () => {
    const { host } = mountEmbed({ capabilities: { pictures: false } });
    await screen.findByRole('toolbar', { name: 'Deck' });
    await addPicture();
    await waitFor(() => {
      expect(changes(host).length).toBeGreaterThan(0);
    });
    expect(typeof assetOf(host.lastText())?.data).toBe('string');
    expect(types(host, 'in').filter((t) => t.startsWith('picture'))).toEqual([]);
    expect(SAMPLE.nodes).toHaveLength(2);
  });
});

import { assetId, type DeckEditor } from '@sododeck/model';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PNG_1X1 } from '../images/test-pictures';
import type * as EditorContextModule from '../model/editor-context';
import { useUiStore } from '../state/ui-store';
import { EditorProbe } from '../test/editor-probe';
import type * as EmbedPicturesModule from './embed-pictures';
import type { HostPictureStore } from './host-picture-store';
import { changes, mountEmbed, opened, sampleText } from './embed-test-kit';

vi.mock('../editor/json-panel', () => ({ JsonPanel: () => null }));
vi.mock('../editor/export/rasterize', () => ({
  rasterize: () => Promise.resolve(new Blob(['png'], { type: 'image/png' })),
}));

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

const calls = {
  fetch: vi.fn(),
  xhr: vi.fn(),
  socket: vi.fn(),
  source: vi.fn(),
  beacon: vi.fn(),
};

beforeEach(() => {
  for (const spy of Object.values(calls)) spy.mockReset();
  vi.stubGlobal('fetch', calls.fetch);
  // `vi.fn` can stand in for a constructor: `new X()` calls it.
  vi.stubGlobal('XMLHttpRequest', calls.xhr);
  vi.stubGlobal('WebSocket', calls.socket);
  vi.stubGlobal('EventSource', calls.source);
  Object.defineProperty(navigator, 'sendBeacon', { value: calls.beacon, configurable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the embed makes no network request (067 SC-005)', () => {
  it('loads, edits, takes an outside change, exports and moves a picture with none', async () => {
    const { host } = mountEmbed({ capabilities: { exportFiles: true, pictures: true } });
    await screen.findByRole('toolbar', { name: 'Deck' });

    // An edit, and the file it sends.
    act(() => {
      opened.editor?.update('nodes', 'api', { position: { x: 90, y: 90 } });
    });
    await waitFor(() => {
      expect(changes(host)).toHaveLength(1);
    });

    // An outside change.
    act(() => {
      host.sendExternal(
        sampleText({
          nodes: [
            { id: 'api', type: 'service', title: 'Billing API', position: { x: 90, y: 90 } },
            { id: 'db', type: 'database', title: 'Orders Store', position: { x: 320, y: 0 } },
          ],
        }),
      );
    });
    await screen.findByRole('group', { name: /Orders Store/ });

    // A picture, handed to the host.
    const id = assetId(PNG_1X1);
    await captured.store?.put(id, { type: 'image/png', bytes: PNG_1X1, name: 'dot.png' });
    act(() => {
      opened.editor?.addImages([
        {
          asset: id,
          meta: { type: 'image/png', bytes: PNG_1X1.length, width: 1, height: 1, name: 'dot.png' },
          position: { x: 0, y: 200 },
          size: { width: 64, height: 64 },
        },
      ]);
    });
    await waitFor(() => {
      expect(host.lastText()).toContain('assets/dot.png');
    });

    // A PNG export through the host.
    act(() => {
      useUiStore.getState().openExport(null);
    });
    const dialog = await screen.findByRole('dialog', { name: 'Export deck' });
    const user = userEvent.setup();
    await user.click(within(dialog).getByRole('radio', { name: 'PNG' }));
    const download = within(dialog).getByRole('button', { name: 'Download' });
    await waitFor(() => {
      expect(download).toBeEnabled();
    });
    await user.click(download);
    await waitFor(() => {
      expect(host.log.some((e) => e.dir === 'in' && e.message.type === 'export-file')).toBe(true);
    });

    for (const [name, spy] of Object.entries(calls)) {
      expect(spy, name).not.toHaveBeenCalled();
    }
  });
});

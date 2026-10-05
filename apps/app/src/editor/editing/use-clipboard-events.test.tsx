import { assetId, toJSON } from '@sododeck/model';
import { act, fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IngestPorts } from '../../images/ingest';
import { PNG_1X1 } from '../../images/test-pictures';
import { useUiStore } from '../../state/ui-store';
import { actionDeck } from '../../test/action-fixtures';
import { editorWrapper } from '../../test/render-canvas';
import { FRAGMENT_HINT_KEY } from './clipboard-ops';
import { useClipboardEvents } from './use-clipboard-events';

const ui = () => useUiStore.getState();

/** A clipboardData stand-in: what the page wrote, or what a paste carries. */
function clipboardData(text = '') {
  const data = new Map<string, string>([['text/plain', text]]);
  return {
    setData: (type: string, value: string) => {
      data.set(type, value);
    },
    getData: (type: string) => data.get(type) ?? '',
    files: [] as File[],
    items: [] as DataTransferItem[],
    text: () => data.get('text/plain') ?? '',
  };
}

function setup() {
  const env = editorWrapper(actionDeck);
  renderHook(
    () => {
      useClipboardEvents();
    },
    { wrapper: env.wrapper },
  );
  return env;
}

function copyNow(target: Element = document.body) {
  const data = clipboardData();
  const notCancelled = fireEvent.copy(target, { clipboardData: data });
  return { text: data.text(), handled: !notCancelled };
}

afterEach(() => {
  localStorage.clear();
});

describe('copy, cut and paste events on the canvas (016 R9)', () => {
  it('copies the selection as a fragment envelope', () => {
    setup();
    act(() => {
      ui().select({ nodes: ['a', 'b'] });
    });
    const { text, handled } = copyNow();
    expect(handled).toBe(true);
    expect(JSON.parse(text)).toMatchObject({ sododeckFragment: 1 });
    expect(ui().announcement.text).toBe('Copied 2 components and 1 connection');
    expect(localStorage.getItem(FRAGMENT_HINT_KEY)).not.toBeNull();
  });

  it('pastes a copied fragment and selects the copies, as one undo step', () => {
    const { doc, editor } = setup();
    act(() => {
      ui().select({ nodes: ['a', 'b'] });
    });
    const { text } = copyNow();
    act(() => {
      ui().setCanvasPointer({ x: 1000, y: 1000 });
    });
    const handled = !fireEvent.paste(document.body, { clipboardData: clipboardData(text) });
    expect(handled).toBe(true);
    const file = toJSON(doc);
    expect(file.nodes).toHaveLength(6);
    const copies = file.nodes.slice(4);
    expect(copies[0]?.position).toEqual({ x: 1000, y: 1000 });
    expect(ui().selection.nodes).toEqual(copies.map((n) => n.id));
    expect(ui().announcement.text).toBe('Pasted 2 components and 1 connection');
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).nodes).toHaveLength(4);
  });

  it('cuts: copies, then asks to delete', () => {
    setup();
    act(() => {
      ui().select({ nodes: ['a'] });
    });
    const data = clipboardData();
    fireEvent.cut(document.body, { clipboardData: data });
    expect(JSON.parse(data.text())).toMatchObject({ sododeckFragment: 1 });
    expect(ui().pendingDelete?.targets).toEqual([{ scope: 'nodes', id: 'a' }]);
  });

  it('leaves text fields, a text selection and plain text to the browser', () => {
    const { doc } = setup();
    act(() => {
      ui().select({ nodes: ['a'] });
    });
    const input = document.createElement('input');
    document.body.append(input);
    expect(copyNow(input).handled).toBe(false);
    expect(fireEvent.paste(document.body, { clipboardData: clipboardData('hello') })).toBe(true);
    expect(toJSON(doc).nodes).toHaveLength(4);
    input.remove();
  });

  it('copies nothing without a copyable selection', () => {
    setup();
    act(() => {
      ui().select({ edges: ['e'] });
    });
    expect(copyNow().handled).toBe(false);
  });

  it('keeps Copy but refuses cut and paste in flow mode', () => {
    const { doc } = setup();
    act(() => {
      ui().select({ nodes: ['a'] });
    });
    const { text } = copyNow();
    act(() => {
      useUiStore.setState({
        activeFlow: {
          flowId: 'f',
          stepId: null,
          branchId: null,
          alternativeId: null,
          playing: false,
          speed: 1,
        },
        selection: { ...ui().selection, nodes: ['a'] },
      });
    });
    expect(copyNow().handled).toBe(true);
    expect(fireEvent.paste(document.body, { clipboardData: clipboardData(text) })).toBe(true);
    expect(toJSON(doc).nodes).toHaveLength(4);
  });

  it('says so when the clipboard cannot be written', async () => {
    setup();
    act(() => {
      ui().select({ nodes: ['a'] });
    });
    fireEvent.copy(document.body, { clipboardData: null });
    expect(await screen.findByText('Could not use the clipboard')).toBeInTheDocument();
  });

  describe('pictures (055)', () => {
    const ports: IngestPorts = {
      decode: () => Promise.resolve({ width: 80, height: 40 }),
      encode: (bytes) => Promise.resolve({ bytes, type: 'image/png' }),
      digest: (bytes) => Promise.resolve(assetId(bytes)),
    };
    const png = () => new File([PNG_1X1.slice().buffer], 'shot.png', { type: 'image/png' });

    /** A paste that carries files (and maybe text). */
    function pasteFiles(files: File[], text = '', target: Element = document.body) {
      const data = { ...clipboardData(text), files };
      return !fireEvent.paste(target, { clipboardData: data });
    }

    function setupImages() {
      const env = editorWrapper(actionDeck, { imagePorts: ports });
      renderHook(
        () => {
          useClipboardEvents();
        },
        { wrapper: env.wrapper },
      );
      return env;
    }

    it('adds a pasted picture at the pointer and selects it, as one undo step', async () => {
      const { doc, editor } = setupImages();
      act(() => {
        ui().setCanvasPointer({ x: 400, y: 300 });
      });
      expect(pasteFiles([png()])).toBe(true);
      await waitFor(() => {
        expect(toJSON(doc).images).toHaveLength(1);
      });
      const [image] = toJSON(doc).images ?? [];
      expect(image?.position).toEqual({ x: 360, y: 280 });
      expect(ui().selection.images).toEqual([image?.id]);
      act(() => {
        editor().undo();
      });
      expect(toJSON(doc).images).toBeUndefined();
    });

    it('lets the picture win when text comes with it', async () => {
      const { doc } = setupImages();
      expect(pasteFiles([png()], '{"sododeckFragment":1}')).toBe(true);
      await waitFor(() => {
        expect(toJSON(doc).images).toHaveLength(1);
      });
      expect(toJSON(doc).nodes).toHaveLength(4);
    });

    it('ignores a picture pasted into a text field, and files that are not pictures', async () => {
      const { doc, store } = setupImages();
      const put = vi.spyOn(store, 'put');
      const input = document.createElement('input');
      document.body.append(input);
      expect(pasteFiles([png()], '', input)).toBe(false);
      expect(pasteFiles([new File(['x'], 'notes.txt', { type: 'text/plain' })])).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(toJSON(doc).images).toBeUndefined();
      expect(put).not.toHaveBeenCalled();
      input.remove();
    });

    it('refuses a pasted picture in view-only modes', async () => {
      const { doc } = setupImages();
      act(() => {
        useUiStore.setState({
          activeFlow: {
            flowId: 'f',
            stepId: null,
            branchId: null,
            alternativeId: null,
            playing: false,
            speed: 1,
          },
        });
      });
      expect(pasteFiles([png()])).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(toJSON(doc).images).toBeUndefined();
    });

    it('says why a pasted picture of an unsupported type is refused', async () => {
      const { doc } = setupImages();
      const bmp = new File([new Uint8Array([0x42, 0x4d, 0, 0, 0, 0])], 'old.bmp', {
        type: 'image/bmp',
      });
      expect(pasteFiles([bmp])).toBe(true);
      expect(
        await screen.findByText(
          'old.bmp: type not supported (use PNG, JPEG, WebP, GIF, SVG or AVIF).',
        ),
      ).toBeInTheDocument();
      expect(toJSON(doc).images).toBeUndefined();
    });
  });
});

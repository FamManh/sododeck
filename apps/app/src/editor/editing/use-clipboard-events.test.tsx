import { toJSON } from '@sododeck/model';
import { act, fireEvent, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

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
});

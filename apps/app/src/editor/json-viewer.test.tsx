import type { EditorProps } from '@monaco-editor/react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useThemeStore } from '../theme/theme-store';
import { lineDiff, toRangeEdit, type RangeEdit } from './line-diff';
import JsonViewer from './json-viewer';

// Monaco cannot run in jsdom: the real editor is replaced by a double that hands the viewer a
// fake editor and model, and records what the viewer does with them.
const fake = vi.hoisted(() => {
  const state = {
    props: null as EditorProps | null,
    commands: new Map<number, () => void>(),
    readOnlyListeners: [] as (() => void)[],
    value: '',
    edits: [] as unknown[],
    setValueCalls: 0,
    themes: [] as string[],
    setThemes: [] as string[],
  };
  return state;
});

vi.mock('./monaco-setup', () => ({
  DECK_MODEL_PATH: 'sododeck://deck/current.sododeck.json',
  SELECTION_MODEL_PATH: 'sododeck://selection/current.json',
  defineSododeckThemes: (monaco: { editor: { defineTheme: (name: string) => void } }) => {
    monaco.editor.defineTheme('sododeck-light');
    monaco.editor.defineTheme('sododeck-dark');
  },
}));

/** Applies an edit the way `model.applyEdits` does (columns clamped to the line). */
function applyEdit(text: string, edit: RangeEdit): string {
  const lines = text.split('\n');
  const offset = (line: number, column: number) =>
    lines.slice(0, line - 1).reduce((sum, l) => sum + l.length + 1, 0) +
    Math.min(column, (lines[line - 1] ?? '').length + 1) -
    1;
  const r = edit.range;
  return (
    text.slice(0, offset(r.startLineNumber, r.startColumn)) +
    edit.text +
    text.slice(offset(r.endLineNumber, r.endColumn))
  );
}

vi.mock('@monaco-editor/react', async () => {
  const { useEffect } = await import('react');
  const KeyMod = { CtrlCmd: 2048, Shift: 1024 };
  const KeyCode = { KeyZ: 56, KeyY: 55 };
  const model = {
    getValue: () => fake.value,
    getLineCount: () => fake.value.split('\n').length,
    applyEdits: (edits: RangeEdit[]) => {
      fake.edits.push(...edits);
      for (const edit of edits) fake.value = applyEdit(fake.value, edit);
    },
    setValue: () => {
      fake.setValueCalls++;
    },
  };
  const editor = {
    addCommand: (keybinding: number, handler: () => void) => {
      fake.commands.set(keybinding, handler);
      return null;
    },
    onDidAttemptReadOnlyEdit: (listener: () => void) => {
      fake.readOnlyListeners.push(listener);
      return { dispose: () => undefined };
    },
    getModel: () => model,
    setValue: () => {
      fake.setValueCalls++;
    },
  };
  const monaco = {
    KeyMod,
    KeyCode,
    editor: {
      defineTheme: (name: string) => fake.themes.push(name),
      setTheme: (name: string) => fake.setThemes.push(name),
    },
  };
  function Editor(props: EditorProps) {
    fake.props = props;
    useEffect(() => {
      // Like the real component: a new model starts with the default value.
      fake.value = props.defaultValue ?? '';
      props.beforeMount?.(monaco);
      props.onMount?.(editor as never, monaco);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
    }, []);
    return null;
  }
  return { default: Editor };
});

const CTRL_Z = 2048 | 56;
const SHIFT_CTRL_Z = 2048 | 1024 | 56;
const CTRL_Y = 2048 | 55;

function setup(text = 'a\nb\nc') {
  const handlers = { onReadOnlyAttempt: vi.fn(), onUndo: vi.fn(), onRedo: vi.fn() };
  const view = render(
    <JsonViewer tab="deck" text={text} ariaLabel="Deck JSON, read-only" {...handlers} />,
  );
  return { ...view, handlers };
}

const run = (keybinding: number) => {
  const command = fake.commands.get(keybinding);
  if (!command) throw new Error(`no command for ${String(keybinding)}`);
  command();
};

beforeEach(() => {
  fake.props = null;
  fake.commands.clear();
  fake.readOnlyListeners = [];
  fake.value = '';
  fake.edits = [];
  fake.setValueCalls = 0;
  fake.themes = [];
  fake.setThemes = [];
});

afterEach(() => {
  useThemeStore.setState({ theme: 'light' });
});

describe('JsonViewer', () => {
  it('configures a read-only editor that can still report edit attempts', () => {
    setup();
    const options = fake.props?.options ?? {};
    expect(options).toMatchObject({
      readOnly: true,
      readOnlyMessage: { value: 'Edit on the canvas or in the inspector' },
      dragAndDrop: false,
      dropIntoEditor: { enabled: false },
      folding: true,
      stickyScroll: { enabled: false },
      minimap: { enabled: false },
      renderValidationDecorations: 'on',
      wordWrap: 'off',
      ariaLabel: 'Deck JSON, read-only',
    });
    expect(options).not.toHaveProperty('domReadOnly');
    expect(fake.props).not.toHaveProperty('value');
    expect(fake.props?.defaultValue).toBe('a\nb\nc');
    expect(fake.props?.saveViewState).toBe(true);
  });

  it('reports a refused edit', () => {
    const { handlers } = setup();
    for (const listener of fake.readOnlyListeners) listener();
    expect(handlers.onReadOnlyAttempt).toHaveBeenCalledTimes(1);
  });

  it('maps undo and redo keys to the latest callbacks', () => {
    const { handlers, rerender } = setup();
    run(CTRL_Z);
    run(SHIFT_CTRL_Z);
    run(CTRL_Y);
    expect(handlers.onUndo).toHaveBeenCalledTimes(1);
    expect(handlers.onRedo).toHaveBeenCalledTimes(2);

    const next = { onReadOnlyAttempt: vi.fn(), onUndo: vi.fn(), onRedo: vi.fn() };
    rerender(<JsonViewer tab="deck" text={'a\nb\nc'} ariaLabel="Deck JSON, read-only" {...next} />);
    run(CTRL_Z);
    run(CTRL_Y);
    for (const listener of fake.readOnlyListeners) listener();
    expect(next.onUndo).toHaveBeenCalledTimes(1);
    expect(next.onRedo).toHaveBeenCalledTimes(1);
    expect(next.onReadOnlyAttempt).toHaveBeenCalledTimes(1);
    expect(handlers.onUndo).toHaveBeenCalledTimes(1);
  });

  it('applies a new text as one minimal edit, never with setValue', () => {
    const { handlers, rerender } = setup('a\nb\nc');
    rerender(
      <JsonViewer tab="deck" text={'a\nB\nc'} ariaLabel="Deck JSON, read-only" {...handlers} />,
    );
    const diff = lineDiff('a\nb\nc', 'a\nB\nc');
    if (!diff) throw new Error('expected a diff');
    expect(fake.edits).toEqual([toRangeEdit(diff, 3)]);
    expect(fake.value).toBe('a\nB\nc');

    rerender(
      <JsonViewer tab="deck" text={'a\nB\nc'} ariaLabel="Deck JSON, read-only" {...handlers} />,
    );
    expect(fake.edits).toHaveLength(1);
    expect(fake.setValueCalls).toBe(0);
  });

  it('uses one model per tab', () => {
    const { handlers, rerender } = setup();
    expect(fake.props?.path).toBe('sododeck://deck/current.sododeck.json');
    rerender(
      <JsonViewer tab="selection" text="{}" ariaLabel="Selection JSON, read-only" {...handlers} />,
    );
    expect(fake.props?.path).toBe('sododeck://selection/current.json');
    expect(fake.props?.options?.ariaLabel).toBe('Selection JSON, read-only');
  });

  it('uses the token themes and redefines them when the app theme changes', () => {
    setup();
    expect(fake.themes).toEqual(['sododeck-light', 'sododeck-dark']);
    expect(fake.props?.theme).toBe('sododeck-light');
    act(() => {
      useThemeStore.setState({ theme: 'dark' });
    });
    expect(fake.props?.theme).toBe('sododeck-dark');
    expect(fake.themes).toHaveLength(4);
    expect(fake.setThemes.at(-1)).toBe('sododeck-dark');
  });
});

import './monaco-setup';

import Editor from '@monaco-editor/react';
import type * as MonacoNs from 'monaco-editor/editor/editor.api';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { JsonTab } from '../state/json-panel-prefs';
import { useThemeStore } from '../theme/theme-store';
import { lineDiff, toRangeEdit } from './line-diff';
import { DECK_MODEL_PATH, defineSododeckThemes, SELECTION_MODEL_PATH } from './monaco-setup';

export interface JsonViewerProps {
  tab: JsonTab;
  text: string;
  ariaLabel: string;
  onReadOnlyAttempt: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

// Typed from the deep import: @monaco-editor/react's `Monaco` type does not resolve with
// monaco-editor 0.57's exports map.
type MonacoApi = typeof MonacoNs;
type MonacoEditor = MonacoNs.editor.IStandaloneCodeEditor;

/**
 * Read-only Monaco view of the panel text (004 research R2, R3). Lazy-loaded: Monaco is large.
 *
 * - One model per tab (`path`), so each tab keeps its own scroll and folds.
 * - `defaultValue` only seeds a new model. After that each text change goes in as one minimal
 *   line edit; `value`/`setValue` would reset folds and scroll on every update. The model text is
 *   read only to diff against it; it never flows back into the deck.
 * - Not `domReadOnly`: keystrokes must reach Monaco so it can show its read-only message and
 *   report the attempt. Undo/redo keys act on the deck history (research R5).
 */
export default function JsonViewer({
  tab,
  text,
  ariaLabel,
  onReadOnlyAttempt,
  onUndo,
  onRedo,
}: JsonViewerProps) {
  const theme = useThemeStore((state) => state.theme);
  const [editor, setEditor] = useState<MonacoEditor | null>(null);
  const monacoRef = useRef<MonacoApi | null>(null);
  // Commands are registered once; they call the latest props through this ref.
  const callbacks = useRef({ onReadOnlyAttempt, onUndo, onRedo });
  useEffect(() => {
    callbacks.current = { onReadOnlyAttempt, onUndo, onRedo };
  });

  const options = useMemo(
    () => ({
      readOnly: true,
      readOnlyMessage: { value: 'Edit on the canvas or in the inspector' },
      ariaLabel,
      dragAndDrop: false,
      dropIntoEditor: { enabled: false },
      folding: true,
      stickyScroll: { enabled: false },
      minimap: { enabled: false },
      renderValidationDecorations: 'on' as const,
      // Screens 02/16: no line-number gutter, guides or overview ruler; the current line shows
      // only while the viewer has focus.
      guides: { indentation: false },
      renderLineHighlightOnlyWhenFocus: true,
      lineNumbers: 'off' as const,
      lineDecorationsWidth: 16,
      overviewRulerLanes: 0,
      overviewRulerBorder: false,
      hideCursorInOverviewRuler: true,
      wordWrap: 'off' as const,
      fontFamily: "'Geist Mono Variable', ui-monospace, monospace",
      fontSize: 12,
      lineHeight: 19,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
    }),
    [ariaLabel],
  );

  const themeName = theme === 'dark' ? 'sododeck-dark' : 'sododeck-light';
  const definedFor = useRef<string | null>(null);

  const beforeMount = (monaco: MonacoApi) => {
    defineSododeckThemes(monaco);
    definedFor.current = themeName;
  };

  const onMount = (mounted: MonacoEditor, monaco: MonacoApi) => {
    monacoRef.current = monaco;
    const { KeyMod, KeyCode } = monaco;
    mounted.onDidAttemptReadOnlyEdit(() => {
      callbacks.current.onReadOnlyAttempt();
    });
    mounted.addCommand(KeyMod.CtrlCmd | KeyCode.KeyZ, () => {
      callbacks.current.onUndo();
    });
    const redo = () => {
      callbacks.current.onRedo();
    };
    mounted.addCommand(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyZ, redo);
    mounted.addCommand(KeyMod.CtrlCmd | KeyCode.KeyY, redo);
    setEditor(mounted);
  };

  // Runs after the editor has switched to this tab's model (child effects run first).
  useEffect(() => {
    const model = editor?.getModel();
    if (!model) return;
    const diff = lineDiff(model.getValue(), text);
    if (diff) model.applyEdits([toRangeEdit(diff, model.getLineCount())]);
  }, [editor, text, tab]);

  // The token values follow the `.dark` class, so the themes are rebuilt on every switch.
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco || definedFor.current === themeName) return;
    defineSododeckThemes(monaco);
    definedFor.current = themeName;
    monaco.editor.setTheme(themeName);
  }, [themeName]);

  return (
    <Editor
      path={tab === 'deck' ? DECK_MODEL_PATH : SELECTION_MODEL_PATH}
      language="json"
      defaultValue={text}
      saveViewState
      theme={themeName}
      options={options}
      beforeMount={beforeMount}
      onMount={onMount}
    />
  );
}

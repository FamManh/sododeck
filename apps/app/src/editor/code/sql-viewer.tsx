import '../monaco-setup';

import Editor from '@monaco-editor/react';
import type * as MonacoNs from 'monaco-editor/editor/editor.api';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useThemeStore } from '../../theme/theme-store';
import { lineDiff, toRangeEdit } from '../line-diff';
import { defineSododeckThemes, SQL_MODEL_PATH } from '../monaco-setup';

export interface SqlViewerProps {
  scope: 'selection' | 'schema';
  /** Monaco language id: `sql`, `pgsql` or `mysql`. */
  language: string;
  text: string;
  ariaLabel: string;
  onReadOnlyAttempt: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

type MonacoApi = typeof MonacoNs;
type MonacoEditor = MonacoNs.editor.IStandaloneCodeEditor;

/**
 * Read-only Monaco view of the SQL preview (046 R13), built like `json-viewer.tsx`: one model per
 * scope, minimal line edits, undo / redo keys act on the deck.
 */
export default function SqlViewer({
  scope,
  language,
  text,
  ariaLabel,
  onReadOnlyAttempt,
  onUndo,
  onRedo,
}: SqlViewerProps) {
  const theme = useThemeStore((state) => state.theme);
  const [editor, setEditor] = useState<MonacoEditor | null>(null);
  const monacoRef = useRef<MonacoApi | null>(null);
  const callbacks = useRef({ onReadOnlyAttempt, onUndo, onRedo });
  useEffect(() => {
    callbacks.current = { onReadOnlyAttempt, onUndo, onRedo };
  });

  const options = useMemo(
    () => ({
      readOnly: true,
      readOnlyMessage: { value: 'Edit DBML or the canvas' },
      ariaLabel,
      dragAndDrop: false,
      dropIntoEditor: { enabled: false },
      folding: false,
      stickyScroll: { enabled: false },
      minimap: { enabled: false },
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

  useEffect(() => {
    const model = editor?.getModel();
    if (!model) return;
    const diff = lineDiff(model.getValue(), text);
    if (diff) model.applyEdits([toRangeEdit(diff, model.getLineCount())]);
  }, [editor, text, scope]);

  useEffect(() => {
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (monaco && model) monaco.editor.setModelLanguage(model, language);
  }, [editor, language, scope]);

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco || definedFor.current === themeName) return;
    defineSododeckThemes(monaco);
    definedFor.current = themeName;
    monaco.editor.setTheme(themeName);
  }, [themeName]);

  return (
    <Editor
      path={SQL_MODEL_PATH[scope]}
      language={language}
      defaultValue={text}
      saveViewState
      theme={themeName}
      options={options}
      beforeMount={(monaco: MonacoApi) => {
        defineSododeckThemes(monaco);
        definedFor.current = themeName;
      }}
      onMount={onMount}
    />
  );
}

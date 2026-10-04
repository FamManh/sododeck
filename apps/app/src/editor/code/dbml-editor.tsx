import '../monaco-setup';

import Editor from '@monaco-editor/react';
import type * as MonacoNs from 'monaco-editor/editor/editor.api';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { TextProblem } from '../../db/sync/types';
import { useThemeStore } from '../../theme/theme-store';
import { lineDiff, toRangeEdit } from '../line-diff';
import { DBML_MODEL_PATH, defineSododeckThemes } from '../monaco-setup';
import { DBML_LANGUAGE_ID } from './dbml-language';

/** What the session needs from the editor: its text, and a programmatic way to change it. */
export interface DbmlEditorHandle {
  getText: () => string;
  /** One minimal line edit (the cursor and scroll outside it stay); never reported as typing. */
  setText: (text: string) => void;
}

export interface DbmlEditorProps {
  scope: 'selection' | 'schema';
  /** Seeds a new model; later text goes in through the handle. */
  initialText: string;
  ariaLabel: string;
  problems: readonly TextProblem[];
  onReady: (handle: DbmlEditorHandle) => void;
  /** The user typed, pasted, cut or deleted (not a programmatic edit). */
  onUserChange: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

type MonacoApi = typeof MonacoNs;
type MonacoEditor = MonacoNs.editor.IStandaloneCodeEditor;

const SEVERITY = { error: 8, warning: 4 } as const;

/**
 * Editable Monaco view of the schema as DBML (046 R1, R9). Lazy-loaded with the parser-free
 * editor code only; one model per scope. Text from the deck goes in as one minimal `applyEdits`
 * (never `setValue`, which resets folds and scroll). ⌘Z / ⇧⌘Z / ⌘Y act on the deck history so one
 * undo spans canvas and text alike.
 */
export default function DbmlEditor({
  scope,
  initialText,
  ariaLabel,
  problems,
  onReady,
  onUserChange,
  onFocus,
  onBlur,
  onUndo,
  onRedo,
}: DbmlEditorProps) {
  const theme = useThemeStore((state) => state.theme);
  const [editor, setEditor] = useState<MonacoEditor | null>(null);
  const monacoRef = useRef<MonacoApi | null>(null);
  const programmatic = useRef(false);
  const callbacks = useRef({ onReady, onUserChange, onFocus, onBlur, onUndo, onRedo });
  useEffect(() => {
    callbacks.current = { onReady, onUserChange, onFocus, onBlur, onUndo, onRedo };
  });

  const options = useMemo(
    () => ({
      ariaLabel,
      dragAndDrop: false,
      dropIntoEditor: { enabled: false },
      folding: true,
      stickyScroll: { enabled: false },
      minimap: { enabled: false },
      renderValidationDecorations: 'on' as const,
      guides: { indentation: false },
      renderLineHighlightOnlyWhenFocus: true,
      lineNumbers: 'on' as const,
      lineNumbersMinChars: 3,
      lineDecorationsWidth: 12,
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
      insertSpaces: true,
      // The panel's text is a view of the deck: no completions or code actions to apply by accident.
      quickSuggestions: false,
      suggestOnTriggerCharacters: false,
      wordBasedSuggestions: 'off' as const,
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
    mounted.addCommand(KeyMod.CtrlCmd | KeyCode.KeyZ, () => {
      callbacks.current.onUndo();
    });
    const redo = () => {
      callbacks.current.onRedo();
    };
    mounted.addCommand(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyZ, redo);
    mounted.addCommand(KeyMod.CtrlCmd | KeyCode.KeyY, redo);
    mounted.onDidFocusEditorText(() => {
      callbacks.current.onFocus();
    });
    mounted.onDidBlurEditorText(() => {
      callbacks.current.onBlur();
    });
    mounted.onDidChangeModelContent(() => {
      if (!programmatic.current) callbacks.current.onUserChange();
    });
    callbacks.current.onReady({
      getText: () => mounted.getModel()?.getValue() ?? '',
      setText: (text) => {
        const model = mounted.getModel();
        if (!model) return;
        const diff = lineDiff(model.getValue(), text);
        if (!diff) return;
        programmatic.current = true;
        try {
          model.applyEdits([toRangeEdit(diff, model.getLineCount())]);
        } finally {
          programmatic.current = false;
        }
      },
    });
    setEditor(mounted);
  };

  // Problems become markers on their ranges (F8 / ⇧F8 walk them, hover shows the message).
  useEffect(() => {
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!monaco || !model) return;
    monaco.editor.setModelMarkers(
      model,
      'dbml',
      problems.map((problem) => ({
        severity: SEVERITY[problem.severity],
        message: problem.message,
        startLineNumber: problem.line,
        startColumn: problem.column,
        endLineNumber: problem.endLine,
        endColumn: problem.endColumn,
      })),
    );
  }, [editor, problems]);

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco || definedFor.current === themeName) return;
    defineSododeckThemes(monaco);
    definedFor.current = themeName;
    monaco.editor.setTheme(themeName);
  }, [themeName]);

  return (
    <Editor
      path={DBML_MODEL_PATH[scope]}
      language={DBML_LANGUAGE_ID}
      defaultValue={initialText}
      saveViewState
      theme={themeName}
      options={options}
      beforeMount={beforeMount}
      onMount={onMount}
    />
  );
}

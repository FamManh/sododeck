import './monaco-setup';

import Editor from '@monaco-editor/react';

import { useThemeStore } from '../theme/theme-store';
import { DECK_MODEL_PATH } from './monaco-setup';

/** Monaco JSON view of the deck. Read-only until M1 (two-way sync). Lazy-loaded: Monaco is large. */
export default function JsonEditor({ value }: { value: string }) {
  const theme = useThemeStore((state) => state.theme);
  return (
    <Editor
      path={DECK_MODEL_PATH}
      language="json"
      value={value}
      theme={theme === 'dark' ? 'vs-dark' : 'light'}
      options={{
        readOnly: true,
        domReadOnly: true,
        minimap: { enabled: false },
        fontFamily: "'Geist Mono Variable', ui-monospace, monospace",
        fontSize: 12,
        lineHeight: 19,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
      }}
    />
  );
}

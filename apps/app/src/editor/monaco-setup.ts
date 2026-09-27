/**
 * Bundles Monaco locally instead of @monaco-editor/react's default CDN loader:
 * the app must work offline (PWA) and make no third-party requests.
 *
 * Only the editor core, the JSON language and the contributions we use are
 * imported (the full `monaco-editor` entry adds ~12 MB of languages).
 * Deep imports are tied to the monaco-editor version; re-check on upgrade.
 */
import 'monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching';
import 'monaco-editor/editor/contrib/clipboard/browser/clipboard';
import 'monaco-editor/editor/contrib/contextmenu/browser/contextmenu';
import 'monaco-editor/editor/contrib/folding/browser/folding';
import 'monaco-editor/editor/contrib/hover/browser/hoverContribution';
import 'monaco-editor/editor/contrib/readOnlyMessage/browser/contribution';
import 'monaco-editor/editor/contrib/wordHighlighter/browser/wordHighlighter';
import 'monaco-editor/features/find/register';

import { loader } from '@monaco-editor/react';
import { jsonSchema, SCHEMA_URL } from '@sododeck/schema';
import * as monaco from 'monaco-editor/editor/editor.api';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker?worker';
import { jsonDefaults } from 'monaco-editor/languages/features/json/register';

import { buildMonacoTheme, readThemeTokens } from './monaco-theme';

export const DECK_MODEL_PATH = 'sododeck://deck/current.sododeck.json';
/** Does not match the schema's `*.sododeck.json` fileMatch: partial objects are not a deck file. */
export const SELECTION_MODEL_PATH = 'sododeck://selection/current.json';

/**
 * Defines `sododeck-light` and `sododeck-dark` from the current CSS tokens. The tokens follow the
 * `.dark` class, so call it again after the app theme changes.
 */
export function defineSododeckThemes(api: Pick<typeof monaco, 'editor'>): void {
  const tokens = readThemeTokens();
  api.editor.defineTheme('sododeck-light', buildMonacoTheme(tokens, 'vs'));
  api.editor.defineTheme('sododeck-dark', buildMonacoTheme(tokens, 'vs-dark'));
}

self.MonacoEnvironment = {
  getWorker: (_workerId, label) => (label === 'json' ? new JsonWorker() : new EditorWorker()),
};

jsonDefaults.setDiagnosticsOptions({
  validate: true,
  enableSchemaRequest: false, // never fetch schemas over the network
  schemas: [{ uri: SCHEMA_URL, fileMatch: ['*.sododeck.json'], schema: jsonSchema }],
});

loader.config({ monaco });

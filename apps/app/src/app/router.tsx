import { createBrowserRouter } from 'react-router';

import { LibraryPage } from '../routes/library-page';
import { NotFoundPage } from '../routes/not-found-page';

/**
 * Heavy routes (canvas, Monaco, Yjs, the model) are code-split so the library loads fast. The
 * editor route's loader creates (`/deck/new`) or reads a stored deck (editor-page.tsx).
 */
export const router = createBrowserRouter([
  { path: '/', Component: LibraryPage },
  {
    path: '/deck/:deckId',
    // Shown while the editor's code and loader run on a direct page load (a few ms).
    HydrateFallback: () => null,
    lazy: async () => {
      const [{ deckLoader }, { EditorPage }] = await Promise.all([
        import('../routes/deck-loader'),
        import('../routes/editor-page'),
      ]);
      return { loader: deckLoader, Component: EditorPage };
    },
    // The rule editor (008 FR-018): its own address, same doc, undo history and UI state.
    children: [
      {
        path: 'rules/:ruleId?',
        lazy: async () => ({ Component: (await import('../editor/rules/rules-page')).RulesPage }),
      },
    ],
  },
  {
    // Unlinked. Used by the performance benchmark (apps/app/bench).
    path: '/bench',
    lazy: async () => ({ Component: (await import('../routes/bench-page')).BenchPage }),
  },
  // Dev only (FR-026): Vite replaces import.meta.env.DEV with false in production builds,
  // so this route and its lazy chunk are removed; /design then falls through to NotFoundPage.
  ...(import.meta.env.DEV
    ? [
        {
          path: '/design',
          lazy: async () => ({
            Component: (await import('../routes/design-gallery-page')).DesignGalleryPage,
          }),
        },
        {
          // The fake host for the embedded editor (067); not in production builds.
          path: '/embed-host',
          lazy: async () => ({
            Component: (await import('../routes/embed-host-page')).EmbedHostPage,
          }),
        },
      ]
    : []),
  { path: '*', Component: NotFoundPage },
]);

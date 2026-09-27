import { createBrowserRouter } from 'react-router';

import { LibraryPage } from '../routes/library-page';
import { NotFoundPage } from '../routes/not-found-page';

/** Heavy routes (canvas, Monaco) are code-split so the library loads fast. */
export const router = createBrowserRouter([
  { path: '/', Component: LibraryPage },
  {
    path: '/deck/:deckId',
    lazy: async () => ({ Component: (await import('../routes/editor-page')).EditorPage }),
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
      ]
    : []),
  { path: '*', Component: NotFoundPage },
]);

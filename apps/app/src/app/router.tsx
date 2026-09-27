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
  { path: '*', Component: NotFoundPage },
]);

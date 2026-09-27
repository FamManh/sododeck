import { use, type ReactNode } from 'react';

import { getLibraryDb, LibraryDbContext } from './library-db-instance';

/** Provides the database once it is open (suspends until then). */
export function LibraryDbProvider({ children }: { children: ReactNode }) {
  const db = use(getLibraryDb());
  return <LibraryDbContext value={db}>{children}</LibraryDbContext>;
}

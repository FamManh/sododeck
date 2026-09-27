import type * as LibraryClientModule from '../storage/library-client';
import { inProcessLibraryClient } from './in-process-library-client';

/**
 * `vi.mock('../storage/library-client', (orig) => import('../test/mock-library-client').then((m)
 * => m.mockLibraryClient(orig)))`: the library worker's operations run in-process (no Worker in
 * jsdom).
 */
export async function mockLibraryClient(
  importOriginal: <T>() => Promise<T>,
): Promise<typeof LibraryClientModule> {
  const actual = await importOriginal<typeof LibraryClientModule>();
  const client = inProcessLibraryClient();
  return { ...actual, getLibraryClient: () => client };
}

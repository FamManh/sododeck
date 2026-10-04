/**
 * The import client the dialog uses (044 research R5): the worker where module workers exist,
 * else the same pipeline inline. One per page, created on first use, so the parser a preview
 * loaded is still there for the next one.
 */
import {
  createImportClient,
  createInlineImportClient,
  type ImportClient,
} from '../../db/import/import-client';
import { supportsWorkers } from '../../lib/features';

let shared: ImportClient | null = null;

export function getImportClient(): ImportClient {
  shared ??= supportsWorkers() ? createImportClient() : createInlineImportClient();
  return shared;
}

/** Tests replace the client with a fake. */
export function setImportClientForTests(client: ImportClient | null): void {
  shared = client;
}

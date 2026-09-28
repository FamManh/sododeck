import type { DeckDoc } from '@sododeck/model';
import { useState, type ReactNode } from 'react';

import { supportsWorkers } from '../../lib/features';
import {
  createInlineProblemsClient,
  createProblemsClient,
  type ProblemsClient,
} from './problems-client';
import { ProblemsContext } from './problems-context';
import { createProblemsStore, type ProblemsStore } from './problems-store';

function storeFor(doc: DeckDoc, client: ProblemsClient | undefined): ProblemsStore {
  if (client !== undefined) return createProblemsStore(doc, client);
  const own = supportsWorkers() ? createProblemsClient() : createInlineProblemsClient();
  return createProblemsStore(doc, own, { ownsClient: true });
}

/**
 * One problems check per open deck (015 research R5), shared by the inspector list, the canvas
 * button and glyphs, flow and rule rows and ⌘. on both screens. Tests pass an inline client.
 */
export function ProblemsProvider({
  doc,
  client,
  children,
}: {
  doc: DeckDoc;
  client?: ProblemsClient;
  children: ReactNode;
}) {
  const [state, setState] = useState(() => ({ doc, store: storeFor(doc, client) }));
  // A new doc gets a new store (adjusting state during render, like EditorProvider).
  if (state.doc !== doc) setState({ doc, store: storeFor(doc, client) });
  return <ProblemsContext value={state.store}>{children}</ProblemsContext>;
}

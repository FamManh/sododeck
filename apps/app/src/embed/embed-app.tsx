import type { EditorMessage, HostMessage, Transport } from '@sododeck/host-protocol';
import type { DeckDoc } from '@sododeck/model';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { memoryPictureStore, type PictureStore } from '../images/picture-store';
import { blockEditingInput } from './block-input';
import { EmbedDeck } from './embed-deck';
import { EmbedNotices } from './embed-notices';
import { createEmbedSession } from './embed-session';
import { useEmbedStore } from './embed-store';

const RulesPage = lazy(async () => ({
  default: (await import('../editor/rules/rules-page')).RulesPage,
}));

export interface EmbedAppProps {
  transport: Transport<EditorMessage, HostMessage>;
  /** How long to wait for `init` before saying so; tests shorten it. */
  waitMs?: number;
}

/**
 * The embedded editor (067): says `ready`, waits for the host's `init`, then shows the editor on
 * the host's deck in a memory router (nothing touches the host's address bar). The protocol work
 * is `embed-session.ts`; this renders its state. The editor shell is inert while a refused file
 * is on screen (R6): nothing can be edited until a valid one arrives.
 */
export function EmbedApp({ transport, waitMs }: EmbedAppProps) {
  const [open, setOpen] = useState<{ doc: DeckDoc; pictures: PictureStore } | null>(null);
  const phase = useEmbedStore((s) => s.phase);
  const session = useMemo(
    () =>
      createEmbedSession(transport, {
        // One picture store per open deck; the host-backed one replaces it for the pictures ability.
        onOpen: (doc) => {
          setOpen({ doc, pictures: memoryPictureStore() });
        },
        ...(waitMs === undefined ? {} : { waitMs }),
      }),
    [transport, waitMs],
  );
  useEffect(() => session.start(), [session]);
  useEffect(() => (phase === 'blocked' ? blockEditingInput() : undefined), [phase]);

  const router = useMemo(
    () =>
      open === null
        ? null
        : createMemoryRouter(
            [
              {
                path: '/deck/:deckId',
                element: <EmbedDeck doc={open.doc} session={session} pictures={open.pictures} />,
                children: [
                  {
                    path: 'rules/:ruleId?',
                    element: (
                      <Suspense fallback={null}>
                        <RulesPage />
                      </Suspense>
                    ),
                  },
                ],
              },
            ],
            { initialEntries: ['/deck/host'] },
          ),
    [open, session],
  );

  return (
    <>
      <EmbedNotices hasDeck={open !== null} />
      {router !== null && phase !== 'fatal' && (
        <div inert={phase === 'blocked'} data-testid="embed-editor">
          <RouterProvider router={router} />
        </div>
      )}
    </>
  );
}

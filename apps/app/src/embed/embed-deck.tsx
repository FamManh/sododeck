import type { EditorMessage } from '@sododeck/host-protocol';
import type { DeckDoc } from '@sododeck/model';
import { useEffect, useMemo } from 'react';

import { EditorShell } from '../editor/editor-shell';
import type { EmbedHostValue } from '../editor/embed-host-context';
import type { SaveControls } from '../editor/save-context';
import { readPictureBytes } from '../images/read-pictures';
import { parseLinkInput } from '../lib/links';
import { readDeck } from '../model/use-deck-snapshot';
import { EmbedToasts } from './embed-toasts';
import { useEmbedStore } from './embed-store';
import type { HostPictureStore } from './host-picture-store';
import type { EmbedSession } from './embed-session';
import { attachHostPersistence } from './host-persistence';

/**
 * The editor for the host's deck: the shared shell in host mode (067 R10). Its persistence is
 * attached here, in an effect that runs after the shell's own (children first), so the frames the
 * shell fits and the notes it frees on open are not sent to the host as an edit nobody made.
 */
export function EmbedDeck({
  doc,
  session,
  pictures,
}: {
  doc: DeckDoc;
  session: EmbedSession;
  pictures: HostPictureStore;
}) {
  const capabilities = useEmbedStore((s) => s.capabilities);

  useEffect(() => {
    const persistence = attachHostPersistence(
      doc,
      (message) => {
        session.send(message);
      },
      {
        pictureBytes: (current) => readPictureBytes(pictures, readDeck(current)),
        onError: (reason) => {
          useEmbedStore.getState().setHostError(reason);
        },
      },
    );
    session.setPersistence(persistence);
    return () => {
      session.setPersistence(null);
      persistence.destroy();
    };
  }, [doc, session, pictures]);

  const save = useMemo<SaveControls>(
    () => ({
      mode: 'host',
      // ⌘S asks the host to take what is pending; whether it saves is its decision.
      flush: () => session.flushPending(),
      markExported: () => undefined,
    }),
    [session],
  );

  const host = useMemo<EmbedHostValue>(() => {
    const send = (message: EditorMessage) => {
      session.send(message);
    };
    return {
      openLink: capabilities.openLinks
        ? (href) => {
            if (parseLinkInput(href).ok) send({ type: 'open-link', href });
          }
        : null,
      saveFile: capabilities.exportFiles
        ? (name, blob) => {
            void blob.arrayBuffer().then((buffer) => {
              send({ type: 'export-file', name, mime: blob.type, bytes: new Uint8Array(buffer) });
            });
          }
        : null,
    };
  }, [capabilities, session]);

  return (
    <EditorShell
      doc={doc}
      save={save}
      pictures={pictures}
      services={null}
      host={host}
      deckKey={null}
      extras={<EmbedToasts />}
    />
  );
}

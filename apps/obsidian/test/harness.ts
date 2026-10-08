import { emptyDeckText, serializeDeck, toMarkdown } from '@sododeck/model';
import { emptySododeckFile } from '@sododeck/schema';

import { HostSession } from '../src/host-session';
import { FakeEditor, settle } from './fake-editor';
import { fakes, type Fakes } from './fake-vault';

export interface Harness extends Fakes {
  editor: FakeEditor;
  session: HostSession;
  path: string;
  /** Text of the deck file on the fake vault. */
  file(): string;
}

export function deckText(name = 'Shop', title = 'Orders'): string {
  return serializeDeck({
    ...emptySododeckFile(),
    name,
    nodes: [{ id: 'a', type: 'service', title }],
  });
}

export const noteOf = (text: string, previous?: string): string => toMarkdown(text, previous);

/** Opens a session on a deck file in a fresh fake vault, without the canvas saying `ready` yet. */
export function open(path: string, fileText: string, extra?: (f: Fakes) => void): Harness {
  const f = fakes();
  f.vault.seed(path, fileText);
  extra?.(f);
  const editor = new FakeEditor();
  const session = new HostSession({
    path,
    fileText,
    transport: editor.host,
    ports: f.ports,
  });
  return { ...f, editor, session, path, file: () => f.vault.text(path) };
}

/** Opens and completes the `ready` → `init` handshake. */
export async function openReady(
  path: string,
  fileText: string,
  extra?: (f: Fakes) => void,
): Promise<Harness> {
  const h = open(path, fileText, extra);
  h.editor.ready();
  await settle();
  return h;
}

export { emptyDeckText, settle };

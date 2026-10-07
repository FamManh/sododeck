import type { Capabilities, EditorMessage } from '@sododeck/host-protocol';
import { createEditor, DeckEditError, type DeckDoc } from '@sododeck/model';
import { checkPicturePath } from '@sododeck/schema';

import { useEmbedStore } from './embed-store';
import { hostPictureStore, type HostPictureStore } from './host-picture-store';

export interface EmbedPictures {
  store: HostPictureStore;
  /** Stops waiting for pictures that have not shown up in the deck yet. */
  destroy(): void;
}

/**
 * The embed's pictures for one open deck (067 US4): the host-backed store, plus what happens with
 * the host's answers. A stored picture's path goes into the file (`setPicturePath`: untracked, so
 * saved and sent but never an undo step); a refusal or a path the file format would refuse leaves
 * the picture embedded and tells the user why.
 */
export function createEmbedPictures(
  doc: DeckDoc,
  send: (message: EditorMessage) => void,
  isOn: () => Capabilities['pictures'],
): EmbedPictures {
  const editor = createEditor(doc);
  /** Paths that arrived before the deck had the picture (the add and the host race). */
  const waiting = new Map<string, string>();

  const fail = (reason: string) => {
    useEmbedStore.getState().noticePictureKept(reason);
  };

  const write = (id: string, path: string): 'written' | 'waiting' => {
    try {
      editor.setPicturePath(id, path);
      return 'written';
    } catch (error) {
      if (error instanceof DeckEditError && error.code === 'not-found') return 'waiting';
      throw error;
    }
  };

  const retry = () => {
    for (const [id, path] of [...waiting]) {
      if (write(id, path) === 'written') waiting.delete(id);
    }
    if (waiting.size === 0) doc.off('update', retry);
  };

  const store = hostPictureStore(send, {
    isOn,
    onStored: (id, path) => {
      // The host's path is checked here too: a bad one must never reach the file.
      if (checkPicturePath(path) !== null) {
        fail('The host gave an invalid picture path.');
        return;
      }
      if (write(id, path) === 'waiting') {
        waiting.set(id, path);
        doc.on('update', retry);
      }
    },
    onFailed: (_id, reason) => {
      fail(reason);
    },
  });

  return {
    store,
    destroy() {
      doc.off('update', retry);
      waiting.clear();
      editor.destroy();
    },
  };
}

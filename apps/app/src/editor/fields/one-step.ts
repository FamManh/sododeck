import type { DeckEditor } from '@sododeck/model';

/**
 * Runs a discrete write (add a tag, remove a link) as an undo step of its own: never merged with
 * an earlier typing burst on the same object, nor with the next one. Inside a gesture it joins it.
 */
export function oneStep(editor: DeckEditor, write: () => void): void {
  editor.beginGesture();
  try {
    write();
  } finally {
    editor.endGesture();
  }
}

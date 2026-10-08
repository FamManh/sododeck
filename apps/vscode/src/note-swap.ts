/** What the swap decision needs to know about an opened text editor (data-model.md). */
export interface NoteSwapFacts {
  fileName: string;
  /** The text passes the model's `isDeckMarkdown`. */
  hasMarker: boolean;
  /** The user chose "Open as text" for this file in this session. */
  chosenText: boolean;
}

/**
 * Should a text editor that just opened a file become the canvas (R3)? VS Code cannot decline a
 * custom editor per file content, so the canvas is registered as an option and this decides: only
 * a `*.sododeck.md` with the marker, unless the user asked for text. Any other Markdown file
 * stays an ordinary text file (FR-006).
 */
export function shouldSwapToCanvas(facts: NoteSwapFacts): boolean {
  return /\.sododeck\.md$/i.test(facts.fileName) && facts.hasMarker && !facts.chosenText;
}

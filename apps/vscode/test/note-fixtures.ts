import { serializeDeck, toMarkdown } from '@sododeck/model';
import { emptySododeckFile } from '@sododeck/schema';

/** Deck text of a small deck whose card is called `title`. */
export function deckText(title = 'Orders', name = 'Shop'): string {
  return serializeDeck({
    ...emptySododeckFile(),
    name,
    nodes: [{ id: 'a', type: 'service', title }],
  });
}

/** A note followed by a paragraph the user wrote after the generated region. */
export const OWN_TEXT = '\nMy own paragraph.\n';
export const noteWithOwnText = (title = 'Orders'): string =>
  `${toMarkdown(deckText(title))}${OWN_TEXT}`;

/** A note whose card title was edited in the readable part, as text. */
export function noteWithEditedTitle(from: string, to: string): string {
  return toMarkdown(deckText(from)).replace(from, to);
}

/** Markdown with no marker: an ordinary file that must stay text. */
export const unmarkedMarkdown = '# Meeting notes\n\nNothing to see.\n';

/** The marker is there but the deck block is empty. */
export const brokenNote =
  '---\nsododeck-plugin: parsed\n---\n%% sododeck:begin %%\n%% sododeck:end %%\n';

import { LibraryClientError } from '../storage/library-client-error';
import { UNSUPPORTED_DECK_MESSAGE } from '../storage/library-ops-messages';

/** What a failed deck command (rename, duplicate, export) tells the user. */
export function libraryErrorMessage(error: unknown): string {
  if (error instanceof LibraryClientError && error.code === 'unsupported-deck') {
    return UNSUPPORTED_DECK_MESSAGE;
  }
  return 'Something went wrong. Nothing was changed.';
}

const SUPPORTED = 'Supported: flowchart, sequence diagram.';

const UNSUPPORTED_NAMES: Record<string, string> = {
  erdiagram: 'ER diagrams',
  classdiagram: 'Class diagrams',
  statediagram: 'State diagrams',
  'statediagram-v2': 'State diagrams',
  gantt: 'Gantt charts',
  pie: 'Pie charts',
  journey: 'User journeys',
  gitgraph: 'Git graphs',
  mindmap: 'Mind maps',
  timeline: 'Timelines',
};

/**
 * What a refused Mermaid import tells the user (056 FR-017, FR-018); the dialog keeps the text so
 * it can be fixed. Anything that is not a refusal (a failed layout, storage) is generic: nothing
 * was imported either way.
 */
export function mermaidErrorMessage(error: unknown): string {
  if (error instanceof LibraryClientError) {
    switch (error.code) {
      case 'mermaid-empty':
        return 'Nothing to import.';
      case 'mermaid-unsupported-type': {
        const name = UNSUPPORTED_NAMES[error.message.toLowerCase()] ?? `${error.message} diagrams`;
        return `${name} are not supported yet. ${SUPPORTED}`;
      }
      case 'mermaid-nothing-readable':
        return error.message === ''
          ? 'Nothing could be read.'
          : `Nothing could be read. First problem: ${error.message}`;
      case 'mermaid-too-large':
        return 'That diagram is too large (limit: 512 KB, 2,000 components, 4,000 connections).';
    }
  }
  return 'Something went wrong. Nothing was imported.';
}

import { describe, expect, it } from 'vitest';

import { LibraryClientError } from '../storage/library-client-error';
import { libraryErrorMessage, mermaidErrorMessage } from './library-error-message';

describe('libraryErrorMessage', () => {
  it('explains a deck stored by an earlier build (036 FR-027)', () => {
    expect(libraryErrorMessage(new LibraryClientError('unsupported-deck', 'x'))).toBe(
      "This deck was saved by an earlier development build and can't be opened. Import its exported .sododeck file again.",
    );
  });

  it('falls back to a generic message', () => {
    expect(libraryErrorMessage(new Error('boom'))).toBe(
      'Something went wrong. Nothing was changed.',
    );
    expect(libraryErrorMessage(new LibraryClientError('failed', 'x'))).toBe(
      'Something went wrong. Nothing was changed.',
    );
  });
});

describe('mermaidErrorMessage', () => {
  const refused = (code: ConstructorParameters<typeof LibraryClientError>[0], message = '') =>
    mermaidErrorMessage(new LibraryClientError(code, message));

  it('says what each refusal means', () => {
    expect(refused('mermaid-empty')).toBe('Nothing to import.');
    expect(refused('mermaid-unsupported-type', 'erDiagram')).toBe(
      'ER diagrams are not supported yet. Supported: flowchart, sequence diagram.',
    );
    expect(refused('mermaid-unsupported-type', 'classDiagram')).toBe(
      'Class diagrams are not supported yet. Supported: flowchart, sequence diagram.',
    );
    expect(refused('mermaid-unsupported-type', 'quadrantChart')).toBe(
      'quadrantChart diagrams are not supported yet. Supported: flowchart, sequence diagram.',
    );
    expect(refused('mermaid-nothing-readable', 'line 3: ???')).toBe(
      'Nothing could be read. First problem: line 3: ???',
    );
    expect(refused('mermaid-nothing-readable')).toBe('Nothing could be read.');
    expect(refused('mermaid-too-large', 'more than 2000 components')).toBe(
      'That diagram is too large (limit: 512 KB, 2,000 components, 4,000 connections).',
    );
  });

  it('is generic for anything else, and says nothing was imported', () => {
    expect(mermaidErrorMessage(new Error('layout cancelled'))).toBe(
      'Something went wrong. Nothing was imported.',
    );
    expect(refused('failed')).toBe('Something went wrong. Nothing was imported.');
  });
});

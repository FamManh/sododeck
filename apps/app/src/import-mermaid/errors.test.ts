import { describe, expect, it } from 'vitest';

import { importMermaid, LibraryOpError } from '../storage/library-ops';

function refusal(text: string): LibraryOpError {
  try {
    importMermaid(text);
  } catch (error) {
    if (error instanceof LibraryOpError) return error;
    throw error;
  }
  throw new Error('expected a refusal');
}

describe('refused imports (through the worker op)', () => {
  it.each(['', '   \n\t\n'])('empty text %j → mermaid-empty', (text) => {
    expect(refusal(text).code).toBe('mermaid-empty');
  });

  it('text with only comments or front matter is empty', () => {
    expect(refusal('%% nothing here').code).toBe('mermaid-empty');
  });

  it.each([
    ['erDiagram\nA ||--o{ B : has', 'erDiagram'],
    ['classDiagram\nclass A', 'classDiagram'],
    ['gantt\ntitle x', 'gantt'],
  ])('%j → unsupported-type naming the keyword', (text, keyword) => {
    expect(refusal(text)).toMatchObject({ code: 'mermaid-unsupported-type', message: keyword });
  });

  it('a flowchart with no readable node → nothing-readable with the first problem line', () => {
    expect(refusal('flowchart LR\n  --> -->\n  ???')).toMatchObject({
      code: 'mermaid-nothing-readable',
      message: 'line 2: --> -->',
    });
  });

  it('text with no diagram keyword → nothing-readable', () => {
    expect(refusal('just some words')).toMatchObject({
      code: 'mermaid-nothing-readable',
      message: 'line 1: just some words',
    });
  });

  it('a sequence diagram with nothing readable → nothing-readable', () => {
    expect(refusal('sequenceDiagram\nthis is not a message').code).toBe('mermaid-nothing-readable');
  });

  it('more than 512 KB → too-large', () => {
    const text = `flowchart LR\n${'A --> B\n'.repeat(70_000)}`;
    expect(text.length).toBeGreaterThan(512 * 1024);
    expect(refusal(text).code).toBe('mermaid-too-large');
  });

  it('more than 2,000 nodes → too-large', () => {
    const text = `flowchart LR\n${Array.from({ length: 2001 }, (_, i) => `N${i}`).join('\n')}`;
    expect(refusal(text).code).toBe('mermaid-too-large');
  });

  it('more than 4,000 links → too-large', () => {
    expect(refusal(`flowchart LR\n${'A --> B\n'.repeat(4001)}`).code).toBe('mermaid-too-large');
  });

  it('more than 4,000 messages → too-large', () => {
    expect(refusal(`sequenceDiagram\n${'A->>B: x\n'.repeat(4001)}`).code).toBe('mermaid-too-large');
  });
});

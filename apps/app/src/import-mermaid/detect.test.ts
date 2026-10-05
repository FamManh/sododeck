import { describe, expect, it } from 'vitest';

import { diagramType, prepare } from './detect';

const texts = (text: string) => prepare(text).lines.map((l) => l.text.trim());

describe('prepare', () => {
  it('reads plain text and drops blank lines', () => {
    const { lines } = prepare('flowchart LR\n\n  A --> B\n');
    expect(lines.map((l) => [l.line, l.text.trim()])).toEqual([
      [1, 'flowchart LR'],
      [3, 'A --> B'],
    ]);
  });

  it('strips a BOM and normalises Windows and old Mac line endings', () => {
    expect(texts('﻿graph TD\r\nA-->B\rB-->C')).toEqual(['graph TD', 'A-->B', 'B-->C']);
  });

  it('removes a Markdown fence and keeps original line numbers', () => {
    const { lines } = prepare('Some intro\n```mermaid\nflowchart LR\n  A --> B\n```\nafter');
    expect(lines.map((l) => [l.line, l.text.trim()])).toEqual([
      [3, 'flowchart LR'],
      [4, 'A --> B'],
    ]);
  });

  it('takes the first supported diagram and reports the others', () => {
    const text = [
      '```mermaid',
      'erDiagram',
      'A ||--o{ B : has',
      '```',
      '```mermaid',
      'flowchart TD',
      'A --> B',
      '```',
      '```mermaid',
      'sequenceDiagram',
      'A->>B: hi',
      '```',
    ].join('\n');
    const result = prepare(text);
    expect(result.lines.map((l) => l.text)).toEqual(['flowchart TD', 'A --> B']);
    expect(result.extra.map((e) => [e.line, e.text, e.reason])).toEqual([
      [2, 'erDiagram', 'extra-diagram'],
      [10, 'sequenceDiagram', 'extra-diagram'],
    ]);
  });

  it('falls back to the first fenced diagram when none is supported', () => {
    const result = prepare('```\nerDiagram\nA ||--o{ B : has\n```');
    expect(diagramType(result.lines)).toEqual({ unsupported: 'erDiagram' });
  });

  it('removes front matter and keeps its title', () => {
    const result = prepare(
      '---\ntitle: "Checkout flow"\nconfig:\n  theme: dark\n---\nflowchart LR\nA-->B',
    );
    expect(result.title).toBe('Checkout flow');
    expect(result.lines.map((l) => [l.line, l.text])).toEqual([
      [6, 'flowchart LR'],
      [7, 'A-->B'],
    ]);
  });

  it('removes %% comment lines but keeps line numbers', () => {
    const { lines } = prepare('flowchart LR\n%% a note\n  %% indented\nA-->B');
    expect(lines.map((l) => [l.line, l.text])).toEqual([
      [1, 'flowchart LR'],
      [4, 'A-->B'],
    ]);
  });

  it('is empty for empty text', () => {
    expect(prepare('  \n\n').lines).toEqual([]);
  });
});

describe('diagramType', () => {
  it.each([
    ['flowchart LR\nA-->B', 'flowchart'],
    ['graph TD\nA-->B', 'flowchart'],
    ['graph\nA-->B', 'flowchart'],
    ['sequenceDiagram\nA->>B: x', 'sequence'],
    ['erDiagram\nA ||--o{ B : x', { unsupported: 'erDiagram' }],
    ['classDiagram\nclass A', { unsupported: 'classDiagram' }],
    ['stateDiagram-v2\n[*] --> A', { unsupported: 'stateDiagram-v2' }],
    ['hello there', 'none'],
    ['???', 'none'],
    ['', 'none'],
  ])('%j', (text, expected) => {
    expect(diagramType(prepare(text).lines)).toEqual(expected);
  });
});

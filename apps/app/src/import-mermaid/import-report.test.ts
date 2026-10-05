import { describe, expect, it } from 'vitest';

import {
  describeReason,
  EXCERPT_LENGTH,
  LIMITS,
  MermaidImportError,
  skippedLine,
  summaryText,
  type ImportReport,
  type SkipReason,
} from './import-report';

const report = (over: Partial<ImportReport> & Pick<ImportReport, 'kind'>): ImportReport => ({
  counts: { components: 12, connections: 14, groups: 2, steps: 10 },
  skipped: [],
  notes: [],
  ...over,
});

describe('MermaidImportError', () => {
  it.each([
    ['empty', undefined],
    ['unsupported-type', 'erDiagram'],
    ['nothing-readable', 'line 3: what is this'],
    ['too-large', 'more than 2000 components'],
  ] as const)('%s carries its detail', (code, detail) => {
    const error = new MermaidImportError(code, detail);
    expect(error.code).toBe(code);
    expect(error.detail).toBe(detail ?? '');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('limits', () => {
  it('match the contract', () => {
    expect(LIMITS).toEqual({ textBytes: 524288, nodes: 2000, links: 4000 });
  });
});

describe('skippedLine', () => {
  it('trims the line and shortens a long excerpt', () => {
    expect(skippedLine(4, '  style A fill:#fff  ', 'appearance')).toEqual({
      line: 4,
      text: 'style A fill:#fff',
      reason: 'appearance',
    });
    expect(skippedLine(1, 'x'.repeat(300), 'unreadable').text).toHaveLength(EXCERPT_LENGTH);
  });
});

describe('describeReason', () => {
  it.each([
    'appearance',
    'interaction',
    'unsupported',
    'unreadable',
    'flattened',
    'extra-diagram',
  ] as SkipReason[])('gives a sentence for %s', (reason) => {
    expect(describeReason(reason)).toMatch(/\.$/);
  });
});

describe('summaryText', () => {
  it('counts a flowchart', () => {
    expect(summaryText(report({ kind: 'flowchart' }))).toBe(
      '12 components, 14 connections, 2 groups',
    );
  });
  it('counts a sequence diagram as one flow', () => {
    expect(summaryText(report({ kind: 'sequence' }))).toBe(
      '12 components, 14 connections, 1 flow with 10 steps',
    );
  });
  it('uses singular nouns', () => {
    expect(
      summaryText(
        report({
          kind: 'flowchart',
          counts: { components: 1, connections: 1, groups: 1, steps: 0 },
        }),
      ),
    ).toBe('1 component, 1 connection, 1 group');
  });
});

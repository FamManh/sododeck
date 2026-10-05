import { CATALOGUE, inspectDeckText, isCode } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { hasErrors, lintText, validateText } from '../src/lint';
import { example, exampleText, text } from './fixtures';

function withDanglingStep(): string {
  const file = example('checkout.sododeck');
  const flow = file.flows[0];
  if (flow?.steps[2] !== undefined) flow.steps[2] = { ...flow.steps[2], edge: 'nope' };
  return text(file);
}

describe('validate (027 FR-011)', () => {
  it('accepts a clean deck with no entries', () => {
    const { report, file } = validateText(
      exampleText('checkout.sododeck'),
      'checkout.sododeck',
      'test',
    );
    expect(report).toMatchObject({ report: 'sododeck-problems', status: 'opened', problems: [] });
    expect(file?.name).toBe('E-commerce checkout');
  });

  it('refuses a file that is not JSON, with line and column', () => {
    const { report, file } = validateText('{\n  "version": 1,\n  oops\n}', 'bad.sododeck', 'test');
    expect(file).toBeUndefined();
    expect(report.status).toBe('refused');
    expect(report.problems[0]).toMatchObject({ code: 'invalid-json', line: 3 });
    expect(hasErrors(report)).toBe(true);
  });

  it('reports schema violations with the app generic codes and exact paths', () => {
    const file = example('checkout.sododeck') as unknown as { nodes: Record<string, unknown>[] };
    delete file.nodes[1]?.title;
    if (file.nodes[2] !== undefined) file.nodes[2].colour = 'red';
    const { report } = validateText(text(file), 'x.sododeck', 'test');
    expect(report.problems.map((p) => `${p.code} ${p.path ?? ''}`)).toEqual([
      'schema-required /nodes/1/title',
      'schema-unknown-field /nodes/2/colour',
    ]);
  });

  it('leaves problems-list kinds to lint', () => {
    const { report } = validateText(withDanglingStep(), 'x.sododeck', 'test');
    expect(report.problems).toEqual([]);
  });
});

describe('lint (027 FR-012..FR-015)', () => {
  it('prints a fixable entry for a dangling flow step and counts it as an error', () => {
    const { report } = lintText(withDanglingStep(), 'x.sododeck', 'test');
    const entry = report.problems.find((p) => p.path?.startsWith('/flows/0/steps/2'));
    expect(entry).toBeDefined();
    expect(entry).toMatchObject({ severity: 'error', subject: expect.any(String) as string });
    expect(entry?.fix.length).toBeGreaterThan(0);
    expect(entry?.evidence).toBeDefined();
    expect(hasErrors(report)).toBe(true);
  });

  it('uses the same codes, severities and fix hints as the app import', () => {
    const source = withDanglingStep();
    const app = inspectDeckText(source);
    expect(app.ok).toBe(true);
    const skill = lintText(source, 'x.sododeck', 'test').report.problems;
    for (const entry of app.entries) expect(skill).toContainEqual(entry);
  });

  it('adds authoring warnings without failing the gate', () => {
    const file = example('checkout.sododeck');
    if (file.nodes[0] !== undefined)
      file.nodes[0].title = 'A web shop with a title far too long to fit';
    const { report } = lintText(text(file), 'x.sododeck', 'test');
    expect(report.problems.map((p) => p.code)).toEqual(['label-too-long']);
    expect(hasErrors(report)).toBe(false);
  });

  it('passes the dials through to the authoring checks', () => {
    const { report } = lintText(exampleText('checkout.sododeck'), 'x.sododeck', 'test', {
      detail: 'simplified',
    });
    expect(report.problems.map((p) => p.code)).toEqual([]);
    const crowded = lintText(exampleText('platform.sododeck'), 'x.sododeck', 'test', {
      mode: 'codebase',
    });
    expect(crowded.report.problems.every((p) => p.code === 'connector-without-source')).toBe(true);
  });

  it('stops at validate when the file cannot be loaded', () => {
    const { report } = lintText('[]', 'x.sododeck', 'test');
    expect(report.status).toBe('refused');
    expect(
      report.problems.every((p) => isCode(p.code) && CATALOGUE[p.code].family === 'file'),
    ).toBe(true);
  });

  it('is deterministic', () => {
    const source = withDanglingStep();
    expect(lintText(source, 'x', 'test')).toEqual(lintText(source, 'x', 'test'));
  });
});

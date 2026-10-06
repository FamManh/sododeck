import { FORMAT_RULE_CODES, LOAD_ISSUE_CODES, SCHEMA_ISSUE_CODES } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  AUTHORING_CODES,
  CATALOGUE,
  FIDELITY_CODES,
  isCode,
  PROBLEM_KINDS,
  renderCatalogueMarkdown,
  type Code,
} from '../src';

const codes = Object.keys(CATALOGUE) as Code[];

describe('problem code catalogue (062 FR-019)', () => {
  it('gives every code a title and a one-sentence fix ending in a period', () => {
    for (const code of codes) {
      const entry = CATALOGUE[code];
      expect(entry.title, code).not.toBe('');
      expect(entry.fix, code).toMatch(/\.$/);
      expect(entry.fix.trim(), code).toBe(entry.fix);
    }
  });

  it('uses kebab-case codes', () => {
    for (const code of codes) expect(code).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
  });

  it('lists every code the schema, the load checks, the problems list and the importers emit', () => {
    for (const code of [
      ...SCHEMA_ISSUE_CODES,
      ...FORMAT_RULE_CODES,
      ...LOAD_ISSUE_CODES,
      ...PROBLEM_KINDS,
      ...FIDELITY_CODES,
      'invalid-json',
      'unsupported-version',
      'picture-damaged',
      'crop-trimmed',
    ]) {
      expect(isCode(code), code).toBe(true);
    }
  });

  it('keeps the problems-list kinds as codes with their severity', () => {
    for (const kind of PROBLEM_KINDS) {
      expect(CATALOGUE[kind].family).toBe('deck');
      expect(['error', 'warning']).toContain(CATALOGUE[kind].severity);
    }
  });

  it('marks orphan, positions-mixed and group-by-kind as retired, and nothing else', () => {
    expect(CATALOGUE.orphan.retired).toBe(true);
    // 027 rewrite: every card needs a position now (card-without-position).
    expect(CATALOGUE['positions-mixed'].retired).toBe(true);
    const retired = codes.filter((code) => CATALOGUE[code].retired === true);
    expect(CATALOGUE['group-by-kind'].retired).toBe(true);
    expect(retired).toEqual(['orphan', 'positions-mixed', 'group-by-kind']);
  });

  it('gives every import code a fidelity group and info severity', () => {
    for (const code of FIDELITY_CODES) {
      expect(CATALOGUE[code].family).toBe('import');
      expect(CATALOGUE[code].severity).toBe('info');
      expect(CATALOGUE[code].group).toBeDefined();
    }
  });

  it('gives every authoring code its own family and warning severity (027)', () => {
    for (const code of AUTHORING_CODES) {
      expect(CATALOGUE[code].family).toBe('authoring');
      expect(CATALOGUE[code].severity).toBe('warning');
    }
  });

  it('does not know made-up codes', () => {
    expect(isCode('not-a-code')).toBe(false);
  });

  it('publishes the catalogue as docs/file-format/problem-codes.md', async () => {
    await expect(renderCatalogueMarkdown()).toMatchFileSnapshot(
      '../../../docs/file-format/problem-codes.md',
    );
  });
});

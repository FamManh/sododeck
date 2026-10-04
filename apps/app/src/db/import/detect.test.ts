import { describe, expect, it } from 'vitest';

import { DBML_CORPUS, SQL_CORPUS } from '../fixtures/import/corpus';
import { detectDialect, detectFormat } from './detect';

describe('detectFormat', () => {
  it('trusts the extension first', () => {
    expect(detectFormat('Table x {}', 'a.sql')).toBe('sql');
    expect(detectFormat('CREATE TABLE x (a int);', 'a.dbml')).toBe('dbml');
  });

  it('recognises DBML text by its blocks', () => {
    expect(detectFormat(DBML_CORPUS['shop.dbml'])).toBe('dbml');
    expect(detectFormat(DBML_CORPUS['extras.dbml'])).toBe('dbml');
    expect(detectFormat('Ref: a.b > c.d')).toBe('dbml');
    expect(detectFormat(SQL_CORPUS['pg-30-tables.sql'])).toBe('sql');
  });
});

describe('detectDialect', () => {
  it.each([
    ['pg-30-tables.sql', 'postgres'],
    ['mysql-dump.sql', 'mysql'],
    ['sqlite.sql', 'sqlite'],
    ['no-fk.sql', 'mysql'],
  ] as const)('detects %s as %s', (file, dialect) => {
    expect(detectDialect(SQL_CORPUS[file]).dialect).toBe(dialect);
  });

  it('detects nothing in plain ANSI SQL', () => {
    expect(detectDialect('CREATE TABLE t (id int)').dialect).toBeNull();
  });
});

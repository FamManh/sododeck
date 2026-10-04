import { describe, expect, it } from 'vitest';

import { SQL_CORPUS } from '../fixtures/import/corpus';
import { classify, splitSql, stripComments } from './split-sql';

/** The text without comments and blank space, to compare coverage. */
const solid = (text: string) => stripComments(text).replace(/\s+/g, '');

describe('splitSql', () => {
  it.each(Object.entries(SQL_CORPUS))(
    'covers every non-comment character of %s once',
    (_, text) => {
      const statements = splitSql(text);
      // Delimiters are not part of a statement; everything else is, exactly once and in order.
      const bare = (s: string) => s.replace(/;/g, '');
      const joined = statements.map((s) => solid(s.text)).join('');
      expect(bare(joined)).toBe(bare(solid(text)));
    },
  );

  it('gives each statement the line of its first token', () => {
    const text = SQL_CORPUS['pg-30-tables.sql'];
    const view = splitSql(text).find((s) => s.kind === 'view');
    expect(view?.line).toBe(text.split('\n').findIndex((l) => l.startsWith('CREATE VIEW')) + 1);
  });

  it('does not split inside strings, dollar bodies or comments', () => {
    const statements = splitSql(
      'INSERT INTO t VALUES (\'a;b\', "c;d", `e;f`);\nCREATE FUNCTION f() RETURNS int AS $body$ SELECT 1; $body$;\n-- x; y\n/* p; q */ SELECT 2;',
    );
    expect(statements.map((s) => s.kind)).toEqual(['data', 'function', 'other']);
    expect(statements[2]?.line).toBe(4);
  });

  it('reads a MySQL DELIMITER block as one procedure', () => {
    const statements = splitSql(SQL_CORPUS['mysql-dump.sql']);
    const procedure = statements.filter((s) => s.kind === 'procedure');
    expect(procedure).toHaveLength(1);
    expect(procedure[0]?.text).toContain('END');
  });

  it('keeps a COPY data block in its statement', () => {
    const statements = splitSql(SQL_CORPUS['pg-30-tables.sql']);
    const copy = statements.filter((s) => s.kind === 'data');
    expect(copy).toHaveLength(1);
    expect(copy[0]?.text).toContain('Fiction; with a semicolon');
    expect(statements.some((s) => s.text.startsWith('2\t1'))).toBe(false);
  });

  it('classifies statements by their first keywords', () => {
    expect(classify('CREATE UNLOGGED TABLE t (a int)')).toBe('create-table');
    expect(classify('CREATE TABLE p1 PARTITION OF p FOR VALUES IN (1)')).toBe('partition');
    expect(classify('CREATE OR REPLACE MATERIALIZED VIEW v AS SELECT 1')).toBe('view');
    expect(classify('CREATE DEFINER=`root`@`%` VIEW v AS SELECT 1')).toBe('view');
    expect(classify('CREATE UNIQUE INDEX i ON t (a)')).toBe('create-index');
    expect(classify('ALTER TABLE ONLY t OWNER TO me')).toBe('grant');
    expect(classify('ALTER TABLE t ENABLE ROW LEVEL SECURITY')).toBe('policy');
    expect(classify('COMMENT ON COLUMN t.a IS $$x$$')).toBe('comment-on');
    expect(classify('COMMENT ON EXTENSION x IS $$y$$')).toBe('extension');
    expect(classify('SELECT pg_catalog.setval($$s$$, 1)')).toBe('sequence');
    expect(classify('\\connect shop')).toBe('session');
    expect(classify('DROP TABLE t')).toBe('drop');
    expect(classify('VALUES (1)')).toBe('other');
  });
});

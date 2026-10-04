/**
 * Lazy parser loading (044 research R1, R5). The only module that reaches `@dbml/parse` and
 * `node-sql-parser`, always through dynamic `import()`, so each parser is its own chunk and is
 * downloaded only when an import needs it. Used by the import worker and the inline client.
 */
import type { DbmlModule } from './read-dbml';
import type { SqlParser } from './read-sql';
import type { SqlDialect } from './types';

export interface Parsers {
  sql(dialect: SqlDialect): Promise<SqlParser>;
  dbml(): Promise<DbmlModule>;
}

type ParserClass = new () => SqlParser;

/** The `Parser` class of a CommonJS build, whichever way the bundler exposes it. */
function parserClass(module: unknown): ParserClass {
  const record = module as { Parser?: ParserClass; default?: { Parser?: ParserClass } };
  const found = record.Parser ?? record.default?.Parser;
  if (found === undefined) throw new Error('The SQL reader could not load');
  return found;
}

const SQL_BUILDS: Record<SqlDialect, () => Promise<unknown>> = {
  postgres: () => import('node-sql-parser/build/postgresql'),
  mysql: () => import('node-sql-parser/build/mysql'),
  sqlite: () => import('node-sql-parser/build/sqlite'),
};

/** Loads each parser once and keeps it. */
export function createParsers(): Parsers {
  const sql = new Map<SqlDialect, Promise<SqlParser>>();
  let dbml: Promise<DbmlModule> | null = null;
  return {
    sql(dialect) {
      let loaded = sql.get(dialect);
      if (loaded === undefined) {
        loaded = SQL_BUILDS[dialect]().then((module) => new (parserClass(module))());
        sql.set(dialect, loaded);
      }
      return loaded;
    },
    dbml() {
      dbml ??= import('@dbml/parse');
      return dbml;
    },
  };
}

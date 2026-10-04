/**
 * The import fixture corpus (044 research R12), as text. Test-only: imported by the import tests,
 * never by app code.
 */
import edgeCases from './edge-cases.sql?raw';
import extras from './extras.dbml?raw';
import mysqlDump from './mysql-dump.sql?raw';
import noFk from './no-fk.sql?raw';
import pg30 from './pg-30-tables.sql?raw';
import pgSchemas from './pg-schemas.sql?raw';
import shop from './shop.dbml?raw';
import sqlite from './sqlite.sql?raw';
import syntaxError from './syntax-error.sql?raw';

export const SQL_CORPUS = {
  'pg-30-tables.sql': pg30,
  'pg-schemas.sql': pgSchemas,
  'mysql-dump.sql': mysqlDump,
  'sqlite.sql': sqlite,
  'no-fk.sql': noFk,
  'edge-cases.sql': edgeCases,
  'syntax-error.sql': syntaxError,
} as const;

export const DBML_CORPUS = {
  'extras.dbml': extras,
  'shop.dbml': shop,
} as const;

export type CorpusFile = keyof typeof SQL_CORPUS | keyof typeof DBML_CORPUS;

export const CORPUS: Record<CorpusFile, string> = { ...SQL_CORPUS, ...DBML_CORPUS };

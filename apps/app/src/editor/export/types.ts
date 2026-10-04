import type { SchemaFormat } from '../../db/export/types';

export type ImageAndDataFormat = 'json' | 'png' | 'svg';
export type ExportFormat = ImageAndDataFormat | SchemaFormat;
export type ImageScope = 'deck' | 'view' | 'flow';
/** Scope of the schema formats (045): the selected tables, the database card in context, or all. */
export type SchemaScope = 'selection' | 'database' | 'deck';
export type PngScale = 1 | 2 | 3;

const SCHEMA_FORMAT_IDS: readonly ExportFormat[] = ['sql', 'dbml', 'mermaid-er', 'dictionary'];

export function isSchemaFormat(format: ExportFormat): format is SchemaFormat {
  return SCHEMA_FORMAT_IDS.includes(format);
}

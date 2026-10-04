import { Braces, Database, FileText, Image, Network, PenTool } from 'lucide-react';

import type { SchemaFormat } from '../../db/export/types';
import type { ImageAndDataFormat } from './types';

interface FormatEntry<Id> {
  id: Id;
  label: string;
  subtitle: string;
  icon: typeof Braces;
}

/** Schema formats (045), shown only when the deck has a table. SQL's subtitle names the dialect. */
export const SCHEMA_FORMATS: readonly FormatEntry<SchemaFormat>[] = [
  { id: 'sql', label: 'SQL', subtitle: 'In the deck dialect', icon: Database },
  { id: 'dbml', label: 'DBML', subtitle: 'Database markup', icon: Braces },
  { id: 'mermaid-er', label: 'Mermaid ER', subtitle: 'erDiagram for docs', icon: Network },
  {
    id: 'dictionary',
    label: 'Data dictionary',
    subtitle: 'Markdown, one section per table',
    icon: FileText,
  },
];

export const IMAGE_AND_DATA_FORMATS: readonly FormatEntry<ImageAndDataFormat>[] = [
  { id: 'json', label: 'JSON', subtitle: '.sododeck.json · re-importable', icon: Braces },
  { id: 'png', label: 'PNG', subtitle: 'Raster image for docs and slides', icon: Image },
  { id: 'svg', label: 'SVG', subtitle: 'Vector, editable in Figma', icon: PenTool },
];

/** SQL's subtitle: the deck's dialect, or the choice a Generic deck asks for. */
export function sqlSubtitle(dialectName: string | null): string {
  return dialectName === null
    ? 'Choose Postgres, MySQL or SQLite'
    : `In the deck dialect · ${dialectName}`;
}

import { Braces, Image, PenTool } from 'lucide-react';

import type { ExportFormat } from './types';

export const FORMATS = [
  { id: 'json', label: 'JSON', subtitle: '.sododeck.json · re-importable', icon: Braces },
  { id: 'png', label: 'PNG', subtitle: 'Raster image for docs and slides', icon: Image },
  { id: 'svg', label: 'SVG', subtitle: 'Vector, editable in Figma', icon: PenTool },
] as const satisfies readonly {
  id: ExportFormat;
  label: string;
  subtitle: string;
  icon: typeof Braces;
}[];

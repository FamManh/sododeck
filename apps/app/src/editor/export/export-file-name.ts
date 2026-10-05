import { slug } from '../../lib/slug';
import type { ExportFormat } from './types';

export function exportFileName(
  deckName: string | undefined,
  flowName: string | null,
  format: ExportFormat,
): string {
  const deck = slug(deckName) || 'untitled-deck';
  const flow = flowName === null ? '' : slug(flowName);
  const extension = format === 'json' ? 'sododeck' : format;
  return `${deck}${flow ? `-${flow}` : ''}.${extension}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

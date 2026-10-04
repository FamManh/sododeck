import type { SododeckFile } from '@sododeck/schema';
import { memo } from 'react';

import { useUiStore } from '../../state/ui-store';
import { relationshipRows } from '../focus-set';
import { relationshipRowsCss } from './hover-focus-css';

const NONE: readonly string[] = [];

/**
 * The selected relationships' end rows (042 FR-023, FR-001): lit like a hover, with their ports
 * shown. A selection is a deliberate change, so a small React-rendered stylesheet is enough.
 */
export const SelectedRelationshipStyle = memo(function SelectedRelationshipStyle({
  deck,
}: {
  deck: SododeckFile;
}) {
  const edges = useUiStore((s) => (s.selection.edges.length === 0 ? NONE : s.selection.edges));
  if (edges.length === 0) return null;
  const rows = new Set(edges.flatMap((id) => [...relationshipRows(deck, id)]));
  if (rows.size === 0) return null;
  const lines = relationshipRowsCss(rows, []);
  const ports = [...rows].map((row) => `[data-row="${CSS.escape(row)}"] .sd-row-port`);
  lines.push(`[data-canvas] :is(${ports.join(', ')}) { opacity: 1; }`);
  return <style data-testid="selected-relationship-style">{lines.join('\n')}</style>;
});
